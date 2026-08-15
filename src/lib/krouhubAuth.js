import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';

const KROUHUB_URL = process.env.NEXT_PUBLIC_KROUHUB_URL || 'http://localhost:3001';
const JWKS_URL = process.env.KROUHUB_JWKS_URL || `${KROUHUB_URL}/.well-known/jwks.json`;
const TOOL_SLUG = process.env.TOOL_SLUG || 'link';
const ENABLE_MOCK = process.env.ENABLE_LOCAL_AUTH_MOCK === 'true';

let jwksClient = null;

function getJwksClient() {
  if (!jwksClient) {
    try {
      jwksClient = createRemoteJWKSet(new URL(JWKS_URL), {
        cooldownDuration: 30000,
        cacheMaxAge: 3600000, // 1 hora
      });
    } catch (err) {
      console.warn('[KrouHub Auth] Error inicializando cliente JWKS:', err.message);
    }
  }
  return jwksClient;
}

/**
 * Verifica un JWT emitido por KrouHub (offline mediante JWKS o vía API de respaldo).
 * @param {string} token - Token JWT Bearer
 * @returns {Promise<{ valid: boolean, payload?: object, error?: string }>}
 */
export async function verifyKrouHubToken(token) {
  if (!token) {
    return { valid: false, error: 'Token no proporcionado' };
  }

  // 1. Soporte para Modo Mock en desarrollo local
  if (ENABLE_MOCK && token.startsWith('mock_demo_token_')) {
    const isClient = token.includes('client');
    return {
      valid: true,
      payload: {
        sub: 'usr_local_dev_123',
        email: isClient ? 'cliente.demo@krouhub.com' : 'admin.dev@krouhub.com',
        name: isClient ? 'Cliente Agencia Demo' : 'Brian Krou (Dev)',
        role: isClient ? 'CLIENT' : 'ADMIN',
        tool: TOOL_SLUG,
        allowed_tools: [TOOL_SLUG, 'seo-audit', 'calculator-pro'],
        iss: KROUHUB_URL,
        aud: 'krouhub-tools',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
        jti: 'mock-jti-' + Date.now(),
      },
    };
  }

  // 2. Intentar Verificación Offline Criptográfica con JWKS (RS256)
  try {
    const JWKS = getJwksClient();
    if (JWKS) {
      const { payload } = await jwtVerify(token, JWKS, {
        audience: 'krouhub-tools',
      });

      // Verificar que el token conceda acceso a la herramienta actual
      if (
        payload.tool !== TOOL_SLUG &&
        Array.isArray(payload.allowed_tools) &&
        !payload.allowed_tools.includes(TOOL_SLUG)
      ) {
        return {
          valid: false,
          error: `El token no autoriza el acceso a la herramienta "${TOOL_SLUG}".`,
        };
      }

      return { valid: true, payload };
    }
  } catch (jwksErr) {
    console.warn('[KrouHub Auth] Verificación JWKS falló o expirió:', jwksErr.message);

    if (jwksErr.code === 'ERR_JWT_EXPIRED') {
      return { valid: false, error: 'El token de sesión ha expirado.' };
    }
  }

  // 3. Respaldo: Verificar directamente con el endpoint API de KrouHub
  try {
    const verifyEndpoint = `${KROUHUB_URL}/api/v1/tools/verify`;
    const res = await fetch(verifyEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (data.valid) {
        return { valid: true, payload: data.payload };
      }
      return { valid: false, error: data.error || 'Token inválido en KrouHub.' };
    }
  } catch (apiErr) {
    console.error('[KrouHub Auth] Error al contactar endpoint de verificación KrouHub:', apiErr.message);
  }

  // 4. Intentar decodificar como desarrollo local si se habilita fallback
  if (process.env.NODE_ENV === 'development') {
    try {
      const payload = decodeJwt(token);
      if (payload && payload.sub) {
        console.warn('[KrouHub Auth] Usando payload decodificado en modo desarrollo');
        return { valid: true, payload };
      }
    } catch (e) {
      // Ignorar si falla la decodificación pura
    }
  }

  return { valid: false, error: 'No se pudo verificar la validez del token con KrouHub.' };
}
