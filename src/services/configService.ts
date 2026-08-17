export interface DiagnosticResult {
  environment: 'production' | 'local';
  targetKrouhubUrl: string;
  targetJwksUrl: string;
  targetExchangeUrl: string;
  targetValidateSessionUrl: string;
  clientId: string;
  hasClientSecret: boolean;
  mockEnabled: boolean;
  securityStatus: {
    mockDisabledInProd: boolean;
    hasClientSecret: boolean;
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
  exchangeRemoteTest: {
    reachable: boolean;
    statusCode?: number;
    error?: string;
  };
  validateSessionRemoteTest: {
    reachable: boolean;
    statusCode?: number;
    error?: string;
  };
  summary: {
    passed: number;
    warnings: number;
    errors: number;
  };
}

export async function runEnvironmentDiagnostics(envParam: string = 'production'): Promise<DiagnosticResult> {
  const targetEnv = (envParam || 'production').toLowerCase();
  const isProductionTarget = targetEnv === 'production' || targetEnv === 'prod';
  const targetKrouhubUrl = isProductionTarget
    ? 'https://krouhub.com'
    : (process.env.KROUHUB_BASE_URL || 'http://localhost:3000');
  const targetJwksUrl = `${targetKrouhubUrl}/.well-known/jwks.json`;
  const targetExchangeUrl = `${targetKrouhubUrl}/api/v1/tools/exchange`;
  const targetValidateSessionUrl = `${targetKrouhubUrl}/api/v1/tools/validate-session`;
  const clientId = process.env.KROUHUB_CLIENT_ID || 'enlaces';
  const hasClientSecret = !!process.env.KROUHUB_CLIENT_SECRET;
  const mockEnabled = process.env.ENABLE_LOCAL_AUTH_MOCK === 'true';

  let passed = 0;
  let warnings = 0;
  let errors = 0;

  // 1. Security Status
  const mockDisabledInProd = !isProductionTarget || !mockEnabled;
  if (!mockDisabledInProd) errors++; else passed++;

  if (hasClientSecret) passed++; else errors++;

  // 2. Test JWKS Remote HTTP Reachability
  const jwksTest: DiagnosticResult['jwksRemoteTest'] = { reachable: false };
  try {
    const res = await fetch(targetJwksUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
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

  // 3. Test Exchange Remote Endpoint
  const exchangeTest: DiagnosticResult['exchangeRemoteTest'] = { reachable: false };
  try {
    const authHeader = Buffer.from(`${clientId}:${process.env.KROUHUB_CLIENT_SECRET || ''}`).toString('base64');
    const res = await fetch(targetExchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({ code: 'health_check_ping' }),
      cache: 'no-store',
    });
    exchangeTest.statusCode = res.status;
    if (res.status === 400 || res.status === 401 || res.status === 200) {
      exchangeTest.reachable = true;
      passed++;
    } else {
      errors++;
      exchangeTest.error = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    errors++;
    exchangeTest.error = err?.message || 'Error de conexión HTTP';
  }

  // 4. Test Validate Session Remote Endpoint
  const validateSessionTest: DiagnosticResult['validateSessionRemoteTest'] = { reachable: false };
  try {
    const authHeader = Buffer.from(`${clientId}:${process.env.KROUHUB_CLIENT_SECRET || ''}`).toString('base64');
    const res = await fetch(targetValidateSessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({ token: 'health_check_ping' }),
      cache: 'no-store',
    });
    validateSessionTest.statusCode = res.status;
    if (res.status === 401 || res.status === 400 || res.status === 200) {
      validateSessionTest.reachable = true;
      passed++;
    } else {
      errors++;
      validateSessionTest.error = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    errors++;
    validateSessionTest.error = err?.message || 'Error de conexión HTTP';
  }

  return {
    environment: isProductionTarget ? 'production' : 'local',
    targetKrouhubUrl,
    targetJwksUrl,
    targetExchangeUrl,
    targetValidateSessionUrl,
    clientId,
    hasClientSecret,
    mockEnabled,
    securityStatus: {
      mockDisabledInProd,
      hasClientSecret,
    },
    jwksRemoteTest: jwksTest,
    exchangeRemoteTest: exchangeTest,
    validateSessionRemoteTest: validateSessionTest,
    summary: {
      passed,
      warnings,
      errors,
    },
  };
}
