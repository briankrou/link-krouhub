import { NextRequest, NextResponse } from 'next/server';
import { verifyKrouHubToken } from '@/services/authService';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let token: string | null = null;
  const cookieToken = request.cookies.get('krouhub_token')?.value;
  const authHeader = request.headers.get('authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (cookieToken) {
    token = cookieToken;
  }

  const response = NextResponse.next();

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
      console.warn(`[Proxy Middleware] ❌ Token de sesión no válido para la ruta: ${pathname}. Error: ${verification.error || 'Ninguno'}. Pasos:`, verification.logs);
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
