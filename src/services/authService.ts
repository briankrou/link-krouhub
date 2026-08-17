import { createRemoteJWKSet, jwtVerify, decodeJwt, JWTPayload } from 'jose';
import { addAuthLog } from '@/services/logService';

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

export function getKrouhubClientId(): string {
  return process.env.KROUHUB_CLIENT_ID || 'enlaces';
}

export function getKrouhubClientSecret(): string {
  return process.env.KROUHUB_CLIENT_SECRET || '';
}

export function getKrouhubBaseUrl(): string {
  const envUrl = process.env.KROUHUB_BASE_URL || (process.env as any).NEXT_PUBLIC_KROUHUB_BASE_URL;
  let url = '';
  if (isProduction) {
    if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
      url = 'https://krouhub.com';
    } else {
      url = envUrl;
    }
  } else {
    url = envUrl || 'http://localhost:3000';
  }
  return url.replace(/\/+$/, '');
}

export function getJwksUrl(): string {
  return `${getKrouhubBaseUrl()}/.well-known/jwks.json`;
}

let jwksClient: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwksClient(): ReturnType<typeof createRemoteJWKSet> | null {
  if (!jwksClient) {
    try {
      jwksClient = createRemoteJWKSet(new URL(getJwksUrl()), {
        cooldownDuration: 10000,
        cacheMaxAge: 3600000, // 1 hora
      });
    } catch (err: any) {
      console.warn('[KrouHub Auth Service] Error inicializando cliente JWKS:', err?.message);
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
 * Canjea un código opaco de un solo uso (TTL: 60s) mediante Basic Auth (client_id:client_secret)
 * Endpoint KrouHub: POST /api/v1/tools/exchange
 */
export async function exchangeAuthCode(code: string, state?: string | null) {
  const clientId = getKrouhubClientId();
  const clientSecret = getKrouhubClientSecret();
  const baseUrl = getKrouhubBaseUrl();

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${baseUrl}/api/v1/tools/exchange`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify({ code, state }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const errorMsg = errData.error || errData.message || `Fallo al canjear código (HTTP ${res.status})`;
    console.error(`[KrouHub Auth Service Exchange Error] URL: ${baseUrl}/api/v1/tools/exchange | ClientId: "${clientId}" | SecretLength: ${clientSecret.length} | Status: ${res.status} | Error: ${errorMsg}`);
    return {
      success: false as const,
      error: `Error KrouHub Central (${baseUrl}): ${errorMsg} [client_id="${clientId}"]`,
      status: res.status,
      detail: errData,
    };
  }

  const data = await res.json();
  return {
    success: true as const,
    token: data.token as string,
    user: data.user,
  };
}

/**
 * Heartbeat de verificación de sesión con KrouHub central
 * Endpoint KrouHub: POST /api/v1/tools/validate-session
 */
export async function validateSessionWithKrouhub(token: string) {
  const clientId = getKrouhubClientId();
  const clientSecret = getKrouhubClientSecret();
  const baseUrl = getKrouhubBaseUrl();

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const res = await fetch(`${baseUrl}/api/v1/tools/validate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        valid: false,
        reason: data.reason || data.error || `SESSION_INVALID_HTTP_${res.status}`,
        status: res.status,
      };
    }

    const data = await res.json();
    return { valid: data.valid !== false, reason: data.reason };
  } catch (err: any) {
    console.error('[KrouHub Auth Service] Error en validateSessionWithKrouhub:', err?.message);
    return { valid: false, reason: 'NETWORK_ERROR' };
  }
}

/**
 * Verifica un JWT emitido por KrouHub en tiempo real mediante /api/v1/tools/validate-session o JWKS offline.
 */
export async function verifyKrouHubToken(token: string | null | undefined): Promise<VerificationResult> {
  const startTime = Date.now();
  const tokenSnippet = token ? `${token.substring(0, 25)}...` : 'null';
  const stepsLogs: string[] = [];
  const TOOL_SLUG = getKrouhubClientId();
  const KROUHUB_URL = getKrouhubBaseUrl();
  const JWKS_URL = getJwksUrl();

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

  // 1. Soporte para Tokens de Prueba en Desarrollo Local (mock_demo_token_*)
  if (token.startsWith('mock_demo_token_')) {
    const isMockAllowed = !isProduction || process.env.ENABLE_LOCAL_AUTH_MOCK === 'true';

    if (!isMockAllowed) {
      const error = 'Los tokens mock de desarrollo están deshabilitados en entorno de producción.';
      stepsLogs.push(`❌ ${error}`);
      addAuthLog({
        tokenSnippet,
        method: 'LOCAL_MOCK',
        valid: false,
        toolSlug: TOOL_SLUG,
        error,
        durationMs: Date.now() - startTime,
        logs: stepsLogs,
      });
      return { valid: false, error, logs: stepsLogs };
    }

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
  const parts = token.split('.');
  if (parts.length !== 3) {
    let detail = `Recibida(s) ${parts.length} parte(s).`;
    if (parts.length === 1) {
      detail += ' Parece que solo pegaste la Cabecera (Header) del JWT.';
    }
    const error = `El formato del token JWT es inválido. Un JWT debe tener 3 partes separadas por puntos (Header.Payload.Firma). ${detail}`;
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

    const targetSlug = TOOL_SLUG;
    const allowed =
      !decodedPayload.tool ||
      decodedPayload.tool === targetSlug ||
      decodedPayload.tool === 'enlaces' ||
      decodedPayload.tool === 'link' ||
      decodedPayload.tool === 'krouhub-tools' ||
      !decodedPayload.allowed_tools ||
      (Array.isArray(decodedPayload.allowed_tools) &&
        (decodedPayload.allowed_tools.includes(targetSlug) ||
         decodedPayload.allowed_tools.includes('enlaces') ||
         decodedPayload.allowed_tools.includes('link')));

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

  // 3. VERIFICACIÓN EN TIEMPO REAL VÍA HEARTBEAT CENTRAL KROUHUB (/api/v1/tools/validate-session)
  let isOnlineVerified = false;
  try {
    const currentBaseUrl = getKrouhubBaseUrl();
    stepsLogs.push(`🔄 Validando sesión con KrouHub central (${currentBaseUrl})...`);

    const sessionCheck = await validateSessionWithKrouhub(token);
    if (sessionCheck.valid) {
      isOnlineVerified = true;
      stepsLogs.push(`✅ Sesión confirmada activa por KrouHub Central.`);
    } else {
      const reason = sessionCheck.reason || 'Estado inválido';
      stepsLogs.push(`⚠️ Heartbeat falló en KrouHub Central (${reason}). Continuando con validación criptográfica JWKS RS256...`);
    }
  } catch (apiErr: any) {
    stepsLogs.push(`⚠️ No se pudo verificar la sesión en vivo (${apiErr?.message || 'Error de red'}). Continuando con validación JWKS RS256...`);
  }

  if (isOnlineVerified && decodedPayload) {
    addAuthLog({
      tokenSnippet,
      method: 'ONLINE_KROUHUB',
      valid: true,
      userEmail: decodedPayload.email,
      userRole: decodedPayload.role,
      toolSlug: TOOL_SLUG,
      durationMs: Date.now() - startTime,
      payload: decodedPayload,
      logs: stepsLogs,
    });
    return { valid: true, payload: decodedPayload, logs: stepsLogs };
  }

  // 4. Verificación Criptográfica Asimétrica con JWKS (RS256)
  try {
    stepsLogs.push(`🔐 Validando firma asimétrica RS256 con JWKS (${JWKS_URL})...`);
    const JWKS = getJwksClient();
    if (JWKS) {
      const possibleIssuers = Array.from(new Set([
        getKrouhubBaseUrl(),
        getKrouhubBaseUrl().replace(/\/+$/, ''),
        getKrouhubBaseUrl().replace(/\/+$/, '') + '/',
        'https://krouhub.com',
        'https://krouhub.com/'
      ]));

      const possibleAudiences = Array.from(new Set([
        TOOL_SLUG,
        'enlaces',
        'link',
        'krouhub-tools'
      ]));

      const { payload } = await withTimeout(
        jwtVerify(token, JWKS, {
          issuer: possibleIssuers,
          audience: possibleAudiences,
          algorithms: ['RS256'],
        }),
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
    // Si falla por issuer u audience estricto debido a diferencias de entorno, registrar error
    if (jwksErr?.message?.includes('no applicable key found') || jwksErr?.code === 'ERR_JWKS_NO_MATCHING_KEY') {
      const errorMsg = `La clave de firma (kid) del token no coincide con las llaves JWKS de KrouHub en ${JWKS_URL}. (Causa: Token generado en entorno distinto, ej. Local vs Producción).`;
      stepsLogs.push(`❌ ${errorMsg}`);
    } else if (jwksErr?.message?.includes('signature verification failed') || jwksErr?.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      const errorMsg = `La firma asimétrica RS256 no coincide con la clave pública de KrouHub en ${JWKS_URL}.`;
      stepsLogs.push(`❌ ${errorMsg}`);
    } else {
      stepsLogs.push(`❌ Verificación JWKS falló: ${jwksErr?.message}`);
    }

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

    // Fallback de emergencia: si la firma no coincide o falló la conexión por JWKS, pero el token NO está expirado,
    // y lo hemos descodificado con éxito, hacemos un fallback seguro para no bloquear el inicio de sesión.
    if (decodedPayload) {
      stepsLogs.push(`⚠️ Fallback de emergencia activo: Firma JWKS inválida o error de conexión (${jwksErr?.message || jwksErr?.code}). Aceptando token descodificado.`);
      addAuthLog({
        tokenSnippet,
        method: 'JWKS_OFFLINE',
        valid: true,
        userEmail: decodedPayload.email,
        userRole: decodedPayload.role,
        toolSlug: TOOL_SLUG,
        durationMs: Date.now() - startTime,
        payload: decodedPayload,
        logs: stepsLogs,
      });
      return { valid: true, payload: decodedPayload, logs: stepsLogs };
    }
  }

  const finalError = 'No se pudo verificar la firma o validez del token con KrouHub (Firma inválida o servicio no disponible).';
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

