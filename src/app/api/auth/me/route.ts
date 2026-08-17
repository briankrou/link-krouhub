import { NextRequest, NextResponse } from 'next/server';
import {
  verifyKrouHubToken,
  getKrouhubClientId,
  signLocalSessionToken,
  verifyLocalSessionToken,
} from '@/services/authService';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = request.cookies.get('krouhub_token')?.value || null;
  }

  // Fallback a cookie tool_session si el usuario tiene sesión guardada
  const toolSessionCookie = request.cookies.get('tool_session')?.value;

  console.log('[API /api/auth/me] 🔍 Verificando sesión token...');

  let verifiedSessionObj: any = null;
  if (toolSessionCookie) {
    verifiedSessionObj = await verifyLocalSessionToken(toolSessionCookie);
  }

  if (!token && verifiedSessionObj) {
    // Retornar sesión local si la cookie desacoplada tool_session es válida
    return NextResponse.json({
      authenticated: true,
      user: {
        id: verifiedSessionObj.userId || 'usr_tool_session',
        email: verifiedSessionObj.email,
        name: verifiedSessionObj.name || verifiedSessionObj.email,
        role: verifiedSessionObj.role || 'CLIENT',
        allowedTools: [getKrouhubClientId(), 'link'],
      },
    });
  }

  if (!token) {
    console.log('[API /api/auth/me] ⚠️ No se encontró token en Header ni Cookie.');
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }

  const result = await verifyKrouHubToken(token);

  if (!result.valid || !result.payload) {
    // Si falló debido a un error de red y la cookie de sesión local es válida, toleramos hasta 3 veces consecutivas
    if (result.reason === 'NETWORK_ERROR' && verifiedSessionObj) {
      const failuresCookie = request.cookies.get('consecutive_failures')?.value;
      const failures = failuresCookie ? parseInt(failuresCookie, 10) : 0;

      if (failures < 2) { // Intentos 0 y 1 son los primeros dos fallos
        const nextFailures = failures + 1;
        const response = NextResponse.json({
          authenticated: true,
          user: {
            id: verifiedSessionObj.userId || 'usr_tool_session',
            email: verifiedSessionObj.email,
            name: verifiedSessionObj.name || verifiedSessionObj.email,
            role: verifiedSessionObj.role || 'CLIENT',
            allowedTools: [getKrouhubClientId(), 'link'],
          },
          degraded: true,
          reason: 'NETWORK_ERROR',
        });
        response.cookies.set('consecutive_failures', String(nextFailures), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 8 * 60 * 60,
          path: '/',
        });
        console.warn(`[API /api/auth/me] ⚠️ Error de red transitorio (${nextFailures}/3). Manteniendo sesión local degradada.`);
        return response;
      }
    }

    console.log('[API /api/auth/me] ❌ Token inválido o errores de red excedidos:', result.error);
    const response = NextResponse.json(
      { authenticated: false, error: result.error || 'Sesión inválida o revocada', user: null },
      { status: 200 }
    );
    // Limpiamos cookies de sesión
    response.cookies.delete('tool_session');
    response.cookies.delete('krouhub_token');
    response.cookies.delete('consecutive_failures');
    return response;
  }

  const responseBody = {
    authenticated: true,
    user: {
      id: result.payload.sub,
      email: result.payload.email,
      name: result.payload.name || result.payload.email,
      role: result.payload.role,
      allowedTools: result.payload.allowed_tools || (result.payload.tool ? [result.payload.tool] : []),
    },
  };

  console.log('[API /api/auth/me] ✅ Usuario verificado exitosamente:', responseBody.user.email, `(${responseBody.user.role})`);
  
  const response = NextResponse.json(responseBody);
  // Reseteamos contador de fallas consecutivas a 0
  response.cookies.set('consecutive_failures', '0', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60,
    path: '/',
  });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token requerido' }, { status: 400 });
    }

    const result = await verifyKrouHubToken(token);
    
    if (result.valid && result.payload) {
      const isProd = process.env.NODE_ENV === 'production';
      const clientId = getKrouhubClientId();
      
      const sessionToken = await signLocalSessionToken({
        userId: result.payload.sub,
        email: result.payload.email,
        name: result.payload.name || result.payload.email,
        role: result.payload.role || 'CLIENT',
        clientId,
      });

      const response = NextResponse.json(result);
      
      response.cookies.set('tool_session', sessionToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60,
        path: '/',
      });

      response.cookies.set('krouhub_token', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60,
        path: '/',
      });
      
      return response;
    }
    
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err?.message || 'Error del servidor' }, { status: 500 });
  }
}
