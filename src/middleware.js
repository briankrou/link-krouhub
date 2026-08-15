import { NextResponse } from 'next/server';
import { verifyKrouHubToken } from '@/lib/krouhubAuth';

export async function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  // Extraer token desde query parameter (?token=...), Cookie o Header Bearer
  let token = searchParams.get('token');
  const cookieToken = request.cookies.get('krouhub_token')?.value;
  const authHeader = request.headers.get('authorization');

  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token && cookieToken) {
    token = cookieToken;
  }

  // Si la petición trae token por URL, lo guardamos en una cookie HTTP-only
  const response = NextResponse.next();

  if (searchParams.has('token') && token) {
    response.cookies.set('krouhub_token', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });
  }

  // Rutas que requieren validación de autenticación
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

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || 'Token de KrouHub no válido.' },
        { status: 401 }
      );
    }

    // Inyectar datos del usuario validado en los headers de la petición
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
