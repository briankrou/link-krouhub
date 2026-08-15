import { NextRequest, NextResponse } from 'next/server';

interface DiagnosticResult {
  environment: 'production' | 'local';
  targetKrouhubUrl: string;
  targetJwksUrl: string;
  targetVerifyUrl: string;
  toolSlug: string;
  mockEnabled: boolean;
  securityStatus: {
    mockDisabledInProd: boolean;
    hasJwksKeyId: boolean;
    hasValidPublicKey: boolean;
    hasValidPrivateKey: boolean;
  };
  jwksRemoteTest: {
    reachable: boolean;
    statusCode?: number;
    algorithm?: string;
    keyId?: string;
    keyType?: string;
    use?: string;
    error?: string;
  };
  verifyRemoteTest: {
    reachable: boolean;
    statusCode?: number;
    hasCors?: boolean;
    error?: string;
  };
  summary: {
    passed: number;
    warnings: number;
    errors: number;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetEnv = (searchParams.get('env') || 'production').toLowerCase();

  const isProductionTarget = targetEnv === 'production' || targetEnv === 'prod';
  const targetKrouhubUrl = isProductionTarget
    ? 'https://krouhub.com'
    : (process.env.NEXT_PUBLIC_KROUHUB_URL || 'http://localhost:3000');
  const targetJwksUrl = `${targetKrouhubUrl}/.well-known/jwks.json`;
  const targetVerifyUrl = `${targetKrouhubUrl}/api/v1/tools/verify`;
  const toolSlug = process.env.TOOL_SLUG || 'link';
  const mockEnabled = process.env.ENABLE_LOCAL_AUTH_MOCK === 'true';

  let passed = 0;
  let warnings = 0;
  let errors = 0;

  // 1. Security Status
  const mockDisabledInProd = !isProductionTarget || !mockEnabled;
  if (!mockDisabledInProd) errors++; else passed++;

  const hasJwksKeyId = !!process.env.JWKS_KEY_ID;
  if (hasJwksKeyId) passed++; else warnings++;

  let hasValidPublicKey = false;
  if (process.env.JWKS_PUBLIC_KEY) {
    try {
      const decoded = Buffer.from(process.env.JWKS_PUBLIC_KEY, 'base64').toString('utf8');
      hasValidPublicKey = decoded.includes('BEGIN PUBLIC KEY');
      if (hasValidPublicKey) passed++; else warnings++;
    } catch {
      errors++;
    }
  } else {
    warnings++;
  }

  let hasValidPrivateKey = false;
  if (process.env.JWKS_PRIVATE_KEY) {
    try {
      const decoded = Buffer.from(process.env.JWKS_PRIVATE_KEY, 'base64').toString('utf8');
      hasValidPrivateKey = decoded.includes('BEGIN PRIVATE KEY');
      if (hasValidPrivateKey) passed++;
    } catch {
      errors++;
    }
  }

  // 2. Test JWKS Remote HTTP Reachability
  const jwksTest: DiagnosticResult['jwksRemoteTest'] = { reachable: false };
  try {
    const res = await fetch(targetJwksUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    jwksTest.statusCode = res.status;
    if (res.ok) {
      jwksTest.reachable = true;
      const data = await res.json();
      if (Array.isArray(data.keys) && data.keys.length > 0) {
        const key = data.keys[0];
        jwksTest.algorithm = key.alg;
        jwksTest.keyId = key.kid;
        jwksTest.keyType = key.kty;
        jwksTest.use = key.use;
      }
      passed++;
    } else {
      errors++;
      jwksTest.error = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    errors++;
    jwksTest.error = err?.message || 'Error de conexión HTTP';
  }

  // 3. Test Verify Remote HTTP Reachability
  const verifyTest: DiagnosticResult['verifyRemoteTest'] = { reachable: false };
  try {
    const res = await fetch(targetVerifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'config_health_check_ping' }),
      next: { revalidate: 0 },
    });
    verifyTest.statusCode = res.status;
    verifyTest.hasCors = !!res.headers.get('access-control-allow-origin');
    if (res.status === 200 || res.status === 401 || res.status === 400) {
      verifyTest.reachable = true;
      passed++;
    } else {
      errors++;
      verifyTest.error = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    errors++;
    verifyTest.error = err?.message || 'Error de conexión HTTP';
  }

  const result: DiagnosticResult = {
    environment: isProductionTarget ? 'production' : 'local',
    targetKrouhubUrl,
    targetJwksUrl,
    targetVerifyUrl,
    toolSlug,
    mockEnabled,
    securityStatus: {
      mockDisabledInProd,
      hasJwksKeyId,
      hasValidPublicKey,
      hasValidPrivateKey,
    },
    jwksRemoteTest: jwksTest,
    verifyRemoteTest: verifyTest,
    summary: {
      passed,
      warnings,
      errors,
    },
  };

  return NextResponse.json(result);
}
