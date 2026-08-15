import { createRemoteJWKSet, jwtVerify, decodeJwt, JWTPayload } from 'jose';
import { addAuthLog } from '@/lib/authLogs';

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
  logs?: string[];
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
  const startTime = Date.now();
  const tokenSnippet = token ? `${token.substring(0, 25)}...` : 'null';
  const stepsLogs: string[] = [];

  stepsLogs.push(`[${new Date().toLocaleTimeString()}] 📥 Token recibido (${tokenSnippet})`);

  if (!token) {
    const error = 'Token no proporcionado';
    stepsLogs.push(`❌ ${error}`);
    addAuthLog({
      tokenSnippet,
      method: 'INVALID_FORMAT',
      valid: false,
      error,
      durationMs: Date.now() - startTime,
      toolSlug: TOOL_SLUG,
      logs: stepsLogs,
    });
    return { valid: false, error, logs: stepsLogs };
  }

  // 1. Soporte exclusivo para Tokens de Prueba en Desarrollo Local (mock_demo_token_*)
  if (ENABLE_MOCK && token.startsWith('mock_demo_token_')) {
    const isClient = token.includes('client');
    const mockPayload: KrouHubUserPayload = {
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
    };

    stepsLogs.push(`✅ Autenticado vía Local Auth Mock (${mockPayload.email})`);
    addAuthLog({
      tokenSnippet,
      method: 'LOCAL_MOCK',
      valid: true,
      userEmail: mockPayload.email,
      userRole: mockPayload.role,
      toolSlug: TOOL_SLUG,
      durationMs: Date.now() - startTime,
      payload: mockPayload,
      logs: stepsLogs,
    });

    return { valid: true, payload: mockPayload, logs: stepsLogs };
  }

  // 2. Comprobar estructura primaria y expiración inicial
  let decodedPayload: KrouHubUserPayload | null = null;
  try {
    decodedPayload = decodeJwt(token) as KrouHubUserPayload;
    stepsLogs.push(`🔍 JWT descodificado. Claims: sub=${decodedPayload.sub}, email=${decodedPayload.email}, role=${decodedPayload.role}`);

    if (decodedPayload.exp && decodedPayload.exp * 1000 < Date.now()) {
      const error = 'El token de sesión de KrouHub ha expirado (TTL 15 min). Por favor inicia sesión nuevamente.';
      stepsLogs.push(`❌ ${error} (exp: ${new Date(decodedPayload.exp * 1000).toISOString()})`);
      addAuthLog({
        tokenSnippet,
        method: 'EXPIRED',
        valid: false,
        userEmail: decodedPayload.email,
        userRole: decodedPayload.role,
        toolSlug: TOOL_SLUG,
        error,
        durationMs: Date.now() - startTime,
        payload: decodedPayload,
        logs: stepsLogs,
      });
      return { valid: false, error, logs: stepsLogs };
    }

    const allowed =
      decodedPayload.tool === TOOL_SLUG ||
      (Array.isArray(decodedPayload.allowed_tools) &&
        decodedPayload.allowed_tools.includes(TOOL_SLUG));

    if (!allowed) {
      const error = `El token no autoriza el acceso a la herramienta "${TOOL_SLUG}".`;
      stepsLogs.push(`❌ ${error}`);
      addAuthLog({
        tokenSnippet,
        method: 'UNAUTHORIZED_TOOL',
        valid: false,
        userEmail: decodedPayload.email,
        userRole: decodedPayload.role,
        toolSlug: TOOL_SLUG,
        error,
        durationMs: Date.now() - startTime,
        payload: decodedPayload,
        logs: stepsLogs,
      });
      return { valid: false, error, logs: stepsLogs };
    }
  } catch (decodeErr) {
    const error = 'El formato del token JWT es inválido.';
    stepsLogs.push(`❌ ${error}`);
    addAuthLog({
      tokenSnippet,
      method: 'INVALID_FORMAT',
      valid: false,
      toolSlug: TOOL_SLUG,
      error,
      durationMs: Date.now() - startTime,
      logs: stepsLogs,
    });
    return { valid: false, error, logs: stepsLogs };
  }

  // 3. VERIFICACIÓN EN TIEMPO REAL VÍA ENDPOINT CENTRAL KROUHUB (/api/v1/tools/verify)
  try {
    const currentBaseUrl = getKrouhubBaseUrl();
    const verifyEndpoint = `${currentBaseUrl}/api/v1/tools/verify`;
    stepsLogs.push(`🔄 Verificando en tiempo real con KrouHub central (${verifyEndpoint})...`);

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
        stepsLogs.push(`✅ Verificación exitosa en tiempo real con KrouHub (${data.payload.email})`);
        addAuthLog({
          tokenSnippet,
          method: 'ONLINE_KROUHUB',
          valid: true,
          userEmail: data.payload.email,
          userRole: data.payload.role,
          toolSlug: TOOL_SLUG,
          durationMs: Date.now() - startTime,
          payload: data.payload,
          logs: stepsLogs,
        });
        return { valid: true, payload: data.payload as KrouHubUserPayload, logs: stepsLogs };
      } else {
        const error = data.error || 'Sesión no válida o revocada en KrouHub.';
        stepsLogs.push(`❌ Token rechazado por KrouHub Central: ${error}`);
        addAuthLog({
          tokenSnippet,
          method: 'ONLINE_KROUHUB',
          valid: false,
          userEmail: decodedPayload?.email,
          userRole: decodedPayload?.role,
          toolSlug: TOOL_SLUG,
          error,
          durationMs: Date.now() - startTime,
          payload: decodedPayload,
          logs: stepsLogs,
        });
        return { valid: false, error, logs: stepsLogs };
      }
    } else {
      stepsLogs.push(`⚠️ KrouHub API respondió con estatus HTTP ${res.status}. Pasando a respaldo JWKS...`);
    }
  } catch (apiErr: any) {
    stepsLogs.push(`⚠️ No se pudo contactar a KrouHub API (${apiErr?.message}). Pasando a respaldo JWKS...`);
  }

  // 4. Intentar Verificación Criptográfica Asimétrica con JWKS como respaldo
  try {
    stepsLogs.push(`🔐 Validando firma asimétrica RS256 con JWKS (${JWKS_URL})...`);
    const JWKS = getJwksClient();
    if (JWKS) {
      const { payload } = await withTimeout(
        jwtVerify(token, JWKS, { audience: 'krouhub-tools' }),
        3500
      );
      const krouPayload = payload as KrouHubUserPayload;
      stepsLogs.push(`✅ Firma RS256 válida vía JWKS (${krouPayload.email})`);
      addAuthLog({
        tokenSnippet,
        method: 'JWKS_OFFLINE',
        valid: true,
        userEmail: krouPayload.email,
        userRole: krouPayload.role,
        toolSlug: TOOL_SLUG,
        durationMs: Date.now() - startTime,
        payload: krouPayload,
        logs: stepsLogs,
      });
      return { valid: true, payload: krouPayload, logs: stepsLogs };
    }
  } catch (jwksErr: any) {
    stepsLogs.push(`❌ Verificación JWKS falló: ${jwksErr?.message}`);

    if (jwksErr?.code === 'ERR_JWT_EXPIRED') {
      const error = 'El token de sesión ha expirado.';
      addAuthLog({
        tokenSnippet,
        method: 'EXPIRED',
        valid: false,
        userEmail: decodedPayload?.email,
        userRole: decodedPayload?.role,
        toolSlug: TOOL_SLUG,
        error,
        durationMs: Date.now() - startTime,
        payload: decodedPayload,
        logs: stepsLogs,
      });
      return { valid: false, error, logs: stepsLogs };
    }
  }

  const finalError = 'No se pudo verificar la firma o validez del token con KrouHub.';
  stepsLogs.push(`❌ ${finalError}`);
  addAuthLog({
    tokenSnippet,
    method: 'JWKS_OFFLINE',
    valid: false,
    userEmail: decodedPayload?.email,
    userRole: decodedPayload?.role,
    toolSlug: TOOL_SLUG,
    error: finalError,
    durationMs: Date.now() - startTime,
    payload: decodedPayload,
    logs: stepsLogs,
  });

  return { valid: false, error: finalError, logs: stepsLogs };
}

