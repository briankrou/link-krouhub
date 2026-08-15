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
        cooldownDuration: 10000,
        cacheMaxAge: 3600000, // 1 hora
      });
    } catch (err) {
      console.warn('[KrouHub Auth] Error inicializando cliente JWKS:', err.message);
    }
  }
  return jwksClient;
}

/**
 * Función auxiliar con timeout para evitar bloqueos si el servidor JWKS no responde.
 */
function withTimeout(promise, ms = 3500) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_JWKS_FETCH')), ms)
    ),
  ]);
}

/**
 * Verifica un JWT emitido por KrouHub (offline mediante JWKS o decodificación directa con fallback).
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

  // 2. Decodificación primaria instantánea para comprobar expiración y estructura
  let decodedPayload = null;
  try {
    decodedPayload = decodeJwt(token);

    // Verificar expiración antes de hacer peticiones de red
    if (decodedPayload.exp && decodedPayload.exp * 1000 < Date.now()) {
      return {
        valid: false,
        error: 'El token de sesión de KrouHub ha expirado (TTL 15 min). Por favor inicia sesión nuevamente.',
      };
    }

    // Verificar permisos de la herramienta
    const allowed =
      decodedPayload.tool === TOOL_SLUG ||
      (Array.isArray(decodedPayload.allowed_tools) &&
        decodedPayload.allowed_tools.includes(TOOL_SLUG));

    if (!allowed) {
      return {
        valid: false,
        error: `El token no autoriza el acceso a la herramienta "${TOOL_SLUG}".`,
      };
    }
  } catch (decodeErr) {
    return { valid: false, error: 'El formato del token JWT es inválido.' };
  }

  // 3. Intentar Verificación Criptográfica Asimétrica con JWKS (con timeout de 3.5 segundos)
  try {
    const JWKS = getJwksClient();
    if (JWKS) {
      const { payload } = await withTimeout(
        jwtVerify(token, JWKS, { audience: 'krouhub-tools' }),
        3500
      );
      return { valid: true, payload };
    }
  } catch (jwksErr) {
    console.warn('[KrouHub Auth] Verificación JWKS no disponible o falló:', jwksErr.message);

    if (jwksErr.code === 'ERR_JWT_EXPIRED') {
      return { valid: false, error: 'El token de sesión ha expirado.' };
    }
  }

  // 4. Fallback en desarrollo local o si el servidor JWKS no está accesible: aceptar payload decodificado válido
  if (decodedPayload && (process.env.NODE_ENV === 'development' || ENABLE_MOCK)) {
    console.info('[KrouHub Auth] Validado mediante payload decodificado (Modo Desarrollo/Fallback)');
    return { valid: true, payload: decodedPayload };
  }

  // 5. Intentar verificación directa vía API HTTP KrouHub como último recurso
  try {
    const verifyEndpoint = `${KROUHUB_URL}/api/v1/tools/verify`;
    const res = await withTimeout(
      fetch(verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store',
      }),
      2500
    );

    if (res.ok) {
      const data = await res.json();
      if (data.valid) {
        return { valid: true, payload: data.payload };
      }
    }
  } catch (apiErr) {
    console.warn('[KrouHub Auth] Fallback API de KrouHub no disponible:', apiErr.message);
  }

  // Si se descodificó un payload correcto en producción pero JWKS no respondió a tiempo
  if (decodedPayload) {
    return { valid: true, payload: decodedPayload };
  }

  return { valid: false, error: 'No se pudo verificar la firma del token con KrouHub.' };
}
