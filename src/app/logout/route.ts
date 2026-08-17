import { NextRequest, NextResponse } from 'next/server';
import { getKrouhubBaseUrl } from '@/lib/krouhubAuth';

export async function GET(req: NextRequest) {
  const baseUrl = getKrouhubBaseUrl();
  const hostHeader = req.headers.get('host') || req.nextUrl.host;
  const protocol =
    req.headers.get('x-forwarded-proto') ||
    (req.nextUrl.protocol ? req.nextUrl.protocol.replace(':', '') : 'http');
  const cleanHost = hostHeader.replace(/^0\.0\.0\.0/, 'localhost');
  const toolOrigin = `${protocol}://${cleanHost}`;

  // URL a la que KrouHub central redirigirá tras el Single Sign-Out global: el login principal de KrouHub
  const redirectUrl = `${baseUrl}/login`;

  const krouhubLogoutUrl = `${baseUrl}/api/v1/tools/logout?redirectUrl=${encodeURIComponent(redirectUrl)}`;

  const response = NextResponse.redirect(krouhubLogoutUrl);

  // 1. Eliminar cookies de sesión local de la herramienta
  response.cookies.delete('tool_session');
  response.cookies.delete('krouhub_token');

  console.log('[Logout Route] 🚪 Sesión local finalizada. Redirigiendo a KrouHub Central para Single Sign-Out global:', krouhubLogoutUrl);

  return response;
}
