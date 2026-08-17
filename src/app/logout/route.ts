import { NextRequest, NextResponse } from 'next/server';
import { getKrouhubBaseUrl } from '@/services/authService';

export async function GET(req: NextRequest) {
  const baseUrl = getKrouhubBaseUrl();
  const krouhubLogoutUrl = `${baseUrl}/api/v1/tools/logout`;

  const response = NextResponse.redirect(krouhubLogoutUrl);

  // 1. Eliminar cookies de sesión local de la herramienta
  response.cookies.delete('tool_session');
  response.cookies.delete('krouhub_token');

  console.log('[Logout Route] 🚪 Sesión local finalizada. Redirigiendo a KrouHub Central para Logout Global:', krouhubLogoutUrl);

  return response;
}
