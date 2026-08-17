import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeAuthCode,
  getKrouhubBaseUrl,
  getKrouhubClientId,
  verifyKrouHubToken,
  signLocalSessionToken,
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

    // 2. Verificación del JWT (Sin bypass)
    const verification = await verifyKrouHubToken(token);
    if (!verification.valid || !verification.payload) {
      console.error('[SSO Route Error] Verificación de token fallida:', verification.error, '\nDetalles de pasos:', verification.logs);
      return NextResponse.json(
        { error: `Fallo al verificar la firma del token: ${verification.error}` },
        { status: 401 }
      );
    }
    const verifiedPayload = verification.payload;

    // 3. Crear la Sesión Local Desacoplada de la Herramienta (FIRMADA)
    const hostHeader = request.headers.get('host') || request.nextUrl.host;
    const protocol = request.headers.get('x-forwarded-proto') || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
    const cleanHost = hostHeader.replace(/^0\.0\.0\.0/, 'localhost');
    const redirectTarget = new URL('/', `${protocol}://${cleanHost}`);
    const response = NextResponse.redirect(redirectTarget);

    const isProd = process.env.NODE_ENV === 'production';
    const clientId = getKrouhubClientId();
    
    const sessionToken = await signLocalSessionToken({
      userId: verifiedPayload.sub,
      email: verifiedPayload.email,
      name: verifiedPayload.name,
      role: verifiedPayload.role || 'CLIENT',
      clientId,
    });

    // Cookie desacoplada de la herramienta (8 horas TTL)
    response.cookies.set('tool_session', sessionToken, {
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

    console.log(`[SSO Route] ✅ Sesión SSO iniciada correctamente para ${verifiedPayload.email}`);
    return response;
  } catch (err: any) {
    console.error('[SSO Route] Error crítico durante autenticación SSO:', err);
    return NextResponse.json(
      { error: 'Autenticación fallida: ' + (err?.message || 'Error del servidor') },
      { status: 500 }
    );
  }
}
