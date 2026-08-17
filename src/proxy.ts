import { NextRequest, NextResponse } from 'next/server';
import { verifyKrouHubToken } from '@/lib/krouhubAuth';

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  let token = searchParams.get('token');
  const cookieToken = request.cookies.get('krouhub_token')?.value;
  const authHeader = request.headers.get('authorization');

  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token && cookieToken) {
    token = cookieToken;
  }

  const toolSessionCookie = request.cookies.get('tool_session')?.value;

  const response = NextResponse.next();

  if (searchParams.has('token') && token) {
    response.cookies.set('krouhub_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  }

  const isApiProtected = pathname.startsWith('/api/protected');
  const isAuthMe = pathname === '/api/auth/me';

  if (isApiProtected || isAuthMe) {
    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere un token de sesión de KrouHub.' },
        { status: 401 }
      );
    }

    const verification = await verifyKrouHubToken(token);

    if (!verification.valid || !verification.payload) {
      return NextResponse.json(
        { error: verification.error || 'Token de KrouHub no válido.' },
        { status: 401 }
      );
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', verification.payload.sub || '');
    requestHeaders.set('x-user-email', verification.payload.email || '');
    requestHeaders.set('x-user-name', verification.payload.name || '');
    requestHeaders.set('x-user-role', verification.payload.role || '');

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return response;
}

export const config = {
  matcher: ['/api/protected/:path*', '/api/auth/me'],
};
