import { createRemoteJWKSet, jwtVerify, decodeJwt, JWTPayload } from 'jose';

export interface KrouHubUserPayload extends JWTPayload {
  sub: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'CLIENT' | string;
  tool?: string;
  allowed_tools?: string[];
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface VerificationResult {
  valid: boolean;
  payload?: KrouHubUserPayload;
  error?: string;
}

const isProduction =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.VERCEL) ||
  process.env.VERCEL_ENV === 'production';

export function getKrouhubBaseUrl(): string {
  if (isProduction) {
    return 'https://krouhub.com';
  }
  return process.env.NEXT_PUBLIC_KROUHUB_URL || 'http://localhost:3000';
}

export function getJwksUrl(): string {
  const envJwks = process.env.KROUHUB_JWKS_URL;
  if (envJwks) {
    if (isProduction && envJwks.includes('localhost')) {
      console.warn('[KrouHub Auth] ⚠️ KROUHUB_JWKS_URL contiene localhost en producción. Usando https://krouhub.com/.well-known/jwks.json');
      return 'https://krouhub.com/.well-known/jwks.json';
    }
    return envJwks;
  }
  return `${getKrouhubBaseUrl()}/.well-known/jwks.json`;
}

const KROUHUB_URL = getKrouhubBaseUrl();
const JWKS_URL = getJwksUrl();
const TOOL_SLUG = process.env.TOOL_SLUG || 'link';
const ENABLE_MOCK = !isProduction && process.env.ENABLE_LOCAL_AUTH_MOCK === 'true';

let jwksClient: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwksClient(): ReturnType<typeof createRemoteJWKSet> | null {
  if (!jwksClient) {
    try {
      jwksClient = createRemoteJWKSet(new URL(JWKS_URL), {
        cooldownDuration: 10000,
        cacheMaxAge: 3600000, // 1 hora
      });
    } catch (err: any) {
      console.warn('[KrouHub Auth] Error inicializando cliente JWKS:', err?.message);
    }
  }
  return jwksClient;
}

function withTimeout<T>(promise: Promise<T>, ms = 3500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_JWKS_FETCH')), ms)
    ),
  ]);
}

/**
 * Verifica un JWT emitido por KrouHub en tiempo real mediante /api/v1/tools/verify o JWKS offline.
 * No realiza fallbacks desatendidos de tokens no verificados.
 */
export async function verifyKrouHubToken(token: string | null | undefined): Promise<VerificationResult> {
  console.log('[KrouHub Auth] 📥 INPUT TOKEN (primeros 30 caracteres):', token ? `${token.substring(0, 30)}...` : 'null');

  if (!token) {
    console.log('[KrouHub Auth] ❌ RESULTADO: Token no proporcionado');
    return { valid: false, error: 'Token no proporcionado' };
  }

  // 1. Soporte exclusivo para Tokens de Prueba en Desarrollo Local (mock_demo_token_*)
  if (ENABLE_MOCK && token.startsWith('mock_demo_token_')) {
    const isClient = token.includes('client');
    const mockResult: VerificationResult = {
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
    console.log('[KrouHub Auth] ✅ RESULTADO (Mock Local):', mockResult.payload?.email);
    return mockResult;
  }

  // 2. Comprobar estructura primaria y expiración inicial
  let decodedPayload: KrouHubUserPayload | null = null;
  try {
    decodedPayload = decodeJwt(token) as KrouHubUserPayload;

    if (decodedPayload.exp && decodedPayload.exp * 1000 < Date.now()) {
      console.log('[KrouHub Auth] ❌ RESULTADO: Token expirado (exp:', decodedPayload.exp, ')');
      return {
        valid: false,
        error: 'El token de sesión de KrouHub ha expirado (TTL 15 min). Por favor inicia sesión nuevamente.',
      };
    }

    const allowed =
      decodedPayload.tool === TOOL_SLUG ||
      (Array.isArray(decodedPayload.allowed_tools) &&
        decodedPayload.allowed_tools.includes(TOOL_SLUG));

    if (!allowed) {
      console.log('[KrouHub Auth] ❌ RESULTADO: Herramienta no autorizada ("' + TOOL_SLUG + '")');
      return {
        valid: false,
        error: `El token no autoriza el acceso a la herramienta "${TOOL_SLUG}".`,
      };
    }
  } catch (decodeErr) {
    console.log('[KrouHub Auth] ❌ RESULTADO: Formato JWT inválido');
    return { valid: false, error: 'El formato del token JWT es inválido.' };
  }

  // 3. VERIFICACIÓN EN TIEMPO REAL VÍA ENDPOINT CENTRAL KROUHUB (/api/v1/tools/verify)
  // Consulta directamente a KrouHub para revocar al instante en caso de logout o token inválido
  try {
    const currentBaseUrl = getKrouhubBaseUrl();
    const verifyEndpoint = `${currentBaseUrl}/api/v1/tools/verify`;
    console.log(`[KrouHub Auth] 🔄 Consultando en tiempo real a KrouHub (${verifyEndpoint})...`);

    const res = await withTimeout(
      fetch(verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        cache: 'no-store',
      }),
      3000
    );

    if (res.ok) {
      const data = await res.json();
      if (data.valid && data.payload) {
        console.log('[KrouHub Auth] ✅ RESULTADO (Verificado en Tiempo Real con KrouHub):', data.payload.email);
        return { valid: true, payload: data.payload as KrouHubUserPayload };
      } else {
        console.log('[KrouHub Auth] ❌ RESULTADO (Rechazado por KrouHub):', data.error || 'Token no válido o revocado');
        return { valid: false, error: data.error || 'Sesión no válida o revocada en KrouHub.' };
      }
    } else {
      console.warn('[KrouHub Auth] Servidor KrouHub respondió con estatus HTTP:', res.status);
    }
  } catch (apiErr: any) {
    console.warn('[KrouHub Auth] Error al conectar con endpoint de verificación en tiempo real de KrouHub:', apiErr?.message);
  }

  // 4. Intentar Verificación Criptográfica Asimétrica con JWKS como respaldo
  try {
    const JWKS = getJwksClient();
    if (JWKS) {
      const { payload } = await withTimeout(
        jwtVerify(token, JWKS, { audience: 'krouhub-tools' }),
        3500
      );
      const krouPayload = payload as KrouHubUserPayload;
      console.log('[KrouHub Auth] ✅ RESULTADO (Verificación JWKS):', krouPayload.email, krouPayload.role);
      return { valid: true, payload: krouPayload };
    }
  } catch (jwksErr: any) {
    console.warn('[KrouHub Auth] Verificación JWKS falló:', jwksErr?.message);

    if (jwksErr?.code === 'ERR_JWT_EXPIRED') {
      console.log('[KrouHub Auth] ❌ RESULTADO: Expirado en JWKS');
      return { valid: false, error: 'El token de sesión ha expirado.' };
    }
  }

  // Sin fallbacks no verificados: Si KrouHub o JWKS no confirmaron la firma o validez, denegar acceso.
  console.log('[KrouHub Auth] ❌ RESULTADO: Firma/Validez no comprobada por KrouHub');
  return { valid: false, error: 'No se pudo verificar la firma o validez del token con KrouHub.' };
}
