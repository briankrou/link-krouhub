import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeAuthCode,
  getKrouhubBaseUrl,
  getKrouhubClientId,
  verifyKrouHubToken,
} from '@/services/authService';

export async function GET(request: NextRequest) {
  // Prevenir que peticiones de prefetch/prerender del navegador consuman el código de un solo uso
  const isPrefetch =
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('x-purpose') === 'preview' ||
    request.headers.get('sec-purpose') === 'prefetch' ||
    request.headers.get('x-moz') === 'prefetch';

  if (isPrefetch) {
    return new NextResponse(null, { status: 204 });
  }

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
      console.error('[SSO Route Error] Canje fallido:', exchangeResult.error);
      return NextResponse.json(
        {
          error: exchangeResult.error || 'Fallo al canjear el código de autorización',
          detail: exchangeResult.detail || null,
        },
        { status: exchangeResult.status || 401 }
      );
    }

    const { token, user: krouUser } = exchangeResult;

    // 2. Verificación del JWT
    let verifiedPayload: any = null;
    try {
      const verification = await verifyKrouHubToken(token);
      if (verification.valid && verification.payload) {
        verifiedPayload = verification.payload;
      } else {
        // Si la verificación estricta JWKS no respondió o falló por red,
        // pero el canje directo server-to-server fue exitoso y devolvió los datos,
        // confiamos en krouUser (fuente de verdad verificada bajo Basic Auth).
        console.warn(`[SSO Route] Verificación JWKS/Heartbeat falló (Error: ${verification.error || 'Ninguno'}). Detalle de pasos:`, verification.logs);
        verifiedPayload = krouUser;
      }
    } catch (verErr: any) {
      console.warn('[SSO Route] Error al intentar verificar token, usando payload de exchange central:', verErr?.message);
      verifiedPayload = krouUser;
    }

    // 3. Crear la Sesión Local Desacoplada de la Herramienta
    const hostHeader = request.headers.get('host') || request.nextUrl.host;
    const protocol = request.headers.get('x-forwarded-proto') || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
    const cleanHost = hostHeader.replace(/^0\.0\.0\.0/, 'localhost');
    const redirectTarget = new URL('/', `${protocol}://${cleanHost}`);
    const response = NextResponse.redirect(redirectTarget);

    const isProd = process.env.NODE_ENV === 'production';
    const clientId = getKrouhubClientId();
    const sessionData = {
      userId: verifiedPayload?.sub || verifiedPayload?.id || krouUser?.id,
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

    // Cookie de token JWT para el heartbeat (ahora httpOnly por seguridad XSS)
    response.cookies.set('krouhub_token', token, {
      httpOnly: true,
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
