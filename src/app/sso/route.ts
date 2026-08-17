import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  exchangeAuthCode,
  getKrouhubBaseUrl,
  getKrouhubClientId,
  getJwksUrl,
  verifyKrouHubToken,
} from '@/lib/krouhubAuth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.json(
      { error: 'Código de autorización no proporcionado' },
      { status: 400 }
    );
  }

  try {
    // 1. Canje Backend-a-Backend (Servidor de la Herramienta -> KrouHub Central)
    const exchangeResult = await exchangeAuthCode(code, state);

    if (!exchangeResult.success || !exchangeResult.token) {
      return NextResponse.json(
        { error: exchangeResult.error || 'Fallo al canjear el código de autorización' },
        { status: exchangeResult.status || 401 }
      );
    }

    const { token, user: krouUser } = exchangeResult;

    // 2. Verificación Criptográfica Asimétrica del JWT RS256 mediante JWKS
    const baseUrl = getKrouhubBaseUrl();
    const clientId = getKrouhubClientId();
    const jwksUrl = getJwksUrl();

    let verifiedPayload: any = null;

    try {
      const JWKS = createRemoteJWKSet(new URL(jwksUrl), {
        cooldownDuration: 10000,
        cacheMaxAge: 3600000,
      });

      const { payload } = await jwtVerify(token, JWKS, {
        algorithms: ['RS256'],
      });

      verifiedPayload = payload;
    } catch (jwksErr: any) {
      console.warn('[SSO Route] Advertencia en jwtVerify directo con JWKS:', jwksErr?.message);
      // Fallback usando el verificador robusto de la librería krouhubAuth
      const verification = await verifyKrouHubToken(token);
      if (!verification.valid || !verification.payload) {
        return NextResponse.json(
          { error: 'Autenticación fallida: Firma de token no válida' },
          { status: 401 }
        );
      }
      verifiedPayload = verification.payload;
    }

    // 3. Crear la Sesión Local Desacoplada de la Herramienta
    const hostHeader = request.headers.get('host') || request.nextUrl.host;
    const protocol = request.headers.get('x-forwarded-proto') || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
    const cleanHost = hostHeader.replace(/^0\.0\.0\.0/, 'localhost');
    const redirectTarget = new URL('/', `${protocol}://${cleanHost}`);
    const response = NextResponse.redirect(redirectTarget);

    const isProd = process.env.NODE_ENV === 'production';
    const sessionData = {
      userId: verifiedPayload?.sub || krouUser?.id,
      email: verifiedPayload?.email || krouUser?.email,
      name: verifiedPayload?.name || krouUser?.name,
      role: verifiedPayload?.role || krouUser?.role || 'CLIENT',
      clientId,
    };

    // Cookie desacoplada de la herramienta (8 horas TTL)
    response.cookies.set('tool_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
      path: '/',
    });

    // Cookie de token JWT para el frontend y cliente API
    response.cookies.set('krouhub_token', token, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60,
      path: '/',
    });

    console.log(`[SSO Route] ✅ Sesión SSO iniciada correctamente para ${sessionData.email}`);
    return response;
  } catch (err: any) {
    console.error('[SSO Route] Error crítico durante autenticación SSO:', err);
    return NextResponse.json(
      { error: 'Autenticación fallida: ' + (err?.message || 'Error del servidor') },
      { status: 500 }
    );
  }
}
