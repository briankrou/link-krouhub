import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
};

// Simple fetch wrapper using native HTTP/HTTPS
function makeRequest(urlStr, options = {}) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.request(
        urlStr,
        {
          method: options.method || 'GET',
          headers: options.headers || {},
          timeout: options.timeout || 6000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            let json = null;
            try {
              json = JSON.parse(data);
            } catch (e) {}
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              headers: res.headers,
              body: data,
              json,
            });
          });
        }
      );

      req.on('error', (err) => {
        resolve({
          ok: false,
          status: 0,
          error: err.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          ok: false,
          status: 0,
          error: 'TIMEOUT (6000ms)',
        });
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (err) {
      resolve({
        ok: false,
        status: 0,
        error: err.message,
      });
    }
  });
}

// Load env file if available
function loadEnvFile(filePath) {
  const env = {};
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[key] = val;
        }
      }
    });
  }
  return env;
}

// Parse Arguments
const args = process.argv.slice(2);
let targetEnv = 'all';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--env' && args[i + 1]) {
    targetEnv = args[i + 1].toLowerCase();
  } else if (args[i].startsWith('--env=')) {
    targetEnv = args[i].split('=')[1].toLowerCase();
  }
}

if (targetEnv === 'prod') targetEnv = 'production';

async function checkProductionConfig(envVars) {
  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  🌐 DIAGNÓSTICO DE CONFIGURACIÓN — PRODUCCIÓN      ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}`);

  // Base Production Endpoints
  const prodKrouhubUrl = 'https://krouhub.com';
  const prodJwksUrl = 'https://krouhub.com/.well-known/jwks.json';
  const prodVerifyUrl = 'https://krouhub.com/api/v1/tools/verify';
  const toolSlug = envVars.TOOL_SLUG || 'link';
  const isMockEnabled = envVars.ENABLE_LOCAL_AUTH_MOCK === 'true';

  let passCount = 0;
  let warnCount = 0;
  let errorCount = 0;

  // 1. Check Target URLs
  console.log(`\n${colors.bright}1. Endpoints Objetivo de Producción:${colors.reset}`);
  console.log(`   - KrouHub Base URL: ${colors.yellow}${prodKrouhubUrl}${colors.reset}`);
  console.log(`   - JWKS Endpoint:   ${colors.yellow}${prodJwksUrl}${colors.reset}`);
  console.log(`   - Verify Endpoint: ${colors.yellow}${prodVerifyUrl}${colors.reset}`);
  console.log(`   - Tool Slug Target:${colors.yellow} "${toolSlug}"${colors.reset}`);

  if (envVars.NEXT_PUBLIC_KROUHUB_URL && envVars.NEXT_PUBLIC_KROUHUB_URL !== prodKrouhubUrl) {
    console.log(`   ${colors.yellow}[NOTE] NEXT_PUBLIC_KROUHUB_URL en archivo local está apuntando a: ${envVars.NEXT_PUBLIC_KROUHUB_URL}${colors.reset}`);
    console.log(`          ${colors.dim}Para Vercel Producción debe estar configurado en https://krouhub.com.${colors.reset}`);
  }

  // 2. Security Flags Check
  console.log(`\n${colors.bright}2. Verificación de Banderas de Seguridad (Producción):${colors.reset}`);
  if (isMockEnabled) {
    console.log(`   ${colors.red}[ERROR] ENABLE_LOCAL_AUTH_MOCK está activo (true) en el archivo local.${colors.reset}`);
    console.log(`           ${colors.dim}⚠️ En Producción (Vercel) DEBE ser 'false' para obligar a verificar la firma RS256 de KrouHub.${colors.reset}`);
    errorCount++;
  } else {
    console.log(`   ${colors.green}[OK] ENABLE_LOCAL_AUTH_MOCK desactivado (false).${colors.reset}`);
    passCount++;
  }

  // 3. Cryptographic Keys Check
  console.log(`\n${colors.bright}3. Verificación de Claves RSA (JWKS):${colors.reset}`);
  if (envVars.JWKS_KEY_ID) {
    console.log(`   ${colors.green}[OK] JWKS_KEY_ID configurado:${colors.reset} ${envVars.JWKS_KEY_ID}`);
    passCount++;
  } else {
    console.log(`   ${colors.yellow}[WARN] JWKS_KEY_ID no está definido en variables locales.${colors.reset}`);
    warnCount++;
  }

  if (envVars.JWKS_PUBLIC_KEY) {
    try {
      const decodedPub = Buffer.from(envVars.JWKS_PUBLIC_KEY, 'base64').toString('utf8');
      if (decodedPub.includes('BEGIN PUBLIC KEY')) {
        console.log(`   ${colors.green}[OK] JWKS_PUBLIC_KEY es una clave pública SPKI RSA válida en Base64.${colors.reset}`);
        passCount++;
      } else {
        console.log(`   ${colors.yellow}[WARN] JWKS_PUBLIC_KEY no contiene 'BEGIN PUBLIC KEY'.${colors.reset}`);
        warnCount++;
      }
    } catch (e) {
      console.log(`   ${colors.red}[ERROR] JWKS_PUBLIC_KEY no es Base64 válido.${colors.reset}`);
      errorCount++;
    }
  } else {
    console.log(`   ${colors.yellow}[WARN] JWKS_PUBLIC_KEY no encontrada localmente. Se dependerá de la clave del servidor KrouHub.${colors.reset}`);
    warnCount++;
  }

  // 4. Remote HTTP Connectivity Test to KrouHub JWKS Production
  console.log(`\n${colors.bright}4. Test de Conectividad HTTP con Servidor Central de Producción (JWKS):${colors.reset}`);
  console.log(`   Pidiendo: GET ${prodJwksUrl} ...`);
  const jwksRes = await makeRequest(prodJwksUrl);

  if (jwksRes.ok && jwksRes.json) {
    console.log(`   ${colors.green}[OK] Servidor Central Producción (krouhub.com) respondió con HTTP ${jwksRes.status}.${colors.reset}`);
    if (Array.isArray(jwksRes.json.keys) && jwksRes.json.keys.length > 0) {
      const firstKey = jwksRes.json.keys[0];
      console.log(`   ${colors.green}[OK] Estructura JWKS remota recibida correctamente:${colors.reset}`);
      console.log(`        - Algoritmo (alg): ${colors.cyan}${firstKey.alg || 'N/A'}${colors.reset}`);
      console.log(`        - Key ID (kid):    ${colors.cyan}${firstKey.kid || 'N/A'}${colors.reset}`);
      console.log(`        - Tipo Key (kty):  ${colors.cyan}${firstKey.kty || 'N/A'}${colors.reset}`);
      console.log(`        - Uso (use):       ${colors.cyan}${firstKey.use || 'N/A'}${colors.reset}`);
      passCount++;
    } else {
      console.log(`   ${colors.yellow}[WARN] Endpoint JSON no incluye array 'keys'.${colors.reset}`);
      warnCount++;
    }
  } else {
    console.log(`   ${colors.red}[ERROR] Falló la conexión al JWKS de producción: HTTP ${jwksRes.status || 'FALLO'} (${jwksRes.error || 'Sin respuesta'})${colors.reset}`);
    errorCount++;
  }

  // 5. Remote HTTP Test to KrouHub Verify Endpoint Production
  console.log(`\n${colors.bright}5. Test de Conectividad Endpoint /api/v1/tools/verify en Producción:${colors.reset}`);
  console.log(`   Pidiendo: POST ${prodVerifyUrl} ...`);
  const verifyRes = await makeRequest(prodVerifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'test_token_verification_ping' }),
  });

  if (verifyRes.status === 200 || verifyRes.status === 401 || verifyRes.status === 400) {
    console.log(`   ${colors.green}[OK] Endpoint de Verificación online alcanzable en Producción (HTTP ${verifyRes.status}).${colors.reset}`);
    if (verifyRes.headers['access-control-allow-origin']) {
      console.log(`   ${colors.green}[OK] Cabeceras CORS activas en Producción (${verifyRes.headers['access-control-allow-origin']}).${colors.reset}`);
    }
    passCount++;
  } else {
    console.log(`   ${colors.red}[ERROR] Endpoint /api/v1/tools/verify no respondió en Producción: HTTP ${verifyRes.status} (${verifyRes.error || ''}).${colors.reset}`);
    errorCount++;
  }

  // Resumen Producción
  console.log(`\n${colors.bright}----------------------------------------------------${colors.reset}`);
  console.log(`${colors.bright} REPORTE PRODUCCIÓN: ${colors.green}${passCount} Éxitos${colors.reset} | ${colors.yellow}${warnCount} Advertencias${colors.reset} | ${colors.red}${errorCount} Errores${colors.reset}`);
  console.log(`${colors.bright}----------------------------------------------------${colors.reset}`);

  return { passCount, warnCount, errorCount };
}

async function checkLocalConfig(envVars) {
  console.log(`\n${colors.bright}${colors.magenta}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  💻 DIAGNÓSTICO DE CONFIGURACIÓN — LOCAL           ${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}====================================================${colors.reset}`);

  const localKrouhubUrl = envVars.NEXT_PUBLIC_KROUHUB_URL || 'http://localhost:3000';
  const localJwksUrl = envVars.KROUHUB_JWKS_URL || `${localKrouhubUrl}/.well-known/jwks.json`;
  const toolSlug = envVars.TOOL_SLUG || 'link';
  const isMockEnabled = envVars.ENABLE_LOCAL_AUTH_MOCK === 'true';

  let passCount = 0;
  let warnCount = 0;
  let errorCount = 0;

  console.log(`\n${colors.bright}1. Variables de Entorno Locales (.env.local):${colors.reset}`);
  console.log(`   - KrouHub Base URL: ${colors.yellow}${localKrouhubUrl}${colors.reset}`);
  console.log(`   - JWKS URL:        ${colors.yellow}${localJwksUrl}${colors.reset}`);
  console.log(`   - Tool Slug:       ${colors.yellow}${toolSlug}${colors.reset}`);
  console.log(`   - Auth Mock Mode:  ${isMockEnabled ? colors.green + 'ENABLED (true)' : colors.yellow + 'DISABLED (false)'}${colors.reset}`);

  if (isMockEnabled) {
    console.log(`   ${colors.green}[OK] MOCK activo para pruebas locales en puerto 3001.${colors.reset}`);
    passCount++;
  } else {
    console.log(`   ${colors.yellow}[INFO] MOCK desactivado en local; requerirá servidor KrouHub corriendo en puerto 3000.${colors.reset}`);
    warnCount++;
  }

  // HTTP ping to local 3000
  console.log(`\n${colors.bright}2. Test de Conectividad con Servidor Central Local (puerto 3000):${colors.reset}`);
  const localJwksRes = await makeRequest(localJwksUrl);
  if (localJwksRes.ok) {
    console.log(`   ${colors.green}[OK] Servidor Central local en puerto 3000 respondiendo en ${localJwksUrl}.${colors.reset}`);
    passCount++;
  } else {
    console.log(`   ${colors.yellow}[INFO] Servidor KrouHub Local en puerto 3000 no responde actualmente (${localJwksRes.error || 'Offline'}).${colors.reset}`);
    console.log(`          ${colors.dim}Nota: Con ENABLE_LOCAL_AUTH_MOCK=true, la aplicación permite tokens MOCK en local.${colors.reset}`);
    warnCount++;
  }

  console.log(`\n${colors.bright}----------------------------------------------------${colors.reset}`);
  console.log(`${colors.bright} REPORTE LOCAL: ${colors.green}${passCount} Éxitos${colors.reset} | ${colors.yellow}${warnCount} Advertencias${colors.reset} | ${colors.red}${errorCount} Errores${colors.reset}`);
  console.log(`${colors.bright}----------------------------------------------------${colors.reset}`);

  return { passCount, warnCount, errorCount };
}

async function main() {
  const rootDir = process.cwd();
  const envLocalPath = path.join(rootDir, '.env.local');
  const fileEnv = loadEnvFile(envLocalPath);
  const combinedEnv = { ...fileEnv, ...process.env };

  console.log(`\n${colors.bright}${colors.bgBlue}${colors.white}  KROUHUB LINK — VERIFICADOR DE CONFIGURACIÓN  ${colors.reset}`);
  console.log(`${colors.dim}Modo seleccionado: ${targetEnv.toUpperCase()}${colors.reset}`);

  if (targetEnv === 'production' || targetEnv === 'prod') {
    await checkProductionConfig(combinedEnv);
  } else if (targetEnv === 'local') {
    await checkLocalConfig(combinedEnv);
  } else {
    await checkProductionConfig(combinedEnv);
    await checkLocalConfig(combinedEnv);
  }

  console.log(`\n${colors.bright}${colors.green}✓ Verificación completada.${colors.reset}\n`);
}

main().catch((err) => {
  console.error('Error fatal durante la verificación:', err);
  process.exit(1);
});
