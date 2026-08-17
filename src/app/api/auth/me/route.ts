import { NextRequest, NextResponse } from 'next/server';
import { verifyKrouHubToken } from '@/lib/krouhubAuth';

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

  if (!token && toolSessionCookie) {
    try {
      const sessionObj = JSON.parse(toolSessionCookie);
      if (sessionObj && sessionObj.email) {
        // Retornar sesión local si la cookie desacoplada tool_session es válida
        return NextResponse.json({
          authenticated: true,
          user: {
            id: sessionObj.userId || 'usr_tool_session',
            email: sessionObj.email,
            name: sessionObj.name || sessionObj.email,
            role: sessionObj.role || 'CLIENT',
            allowedTools: ['enlaces', 'link'],
          },
        });
      }
    } catch {
      // Si la cookie tool_session está corrupta, ignorar
    }
  }

  if (!token) {
    console.log('[API /api/auth/me] ⚠️ No se encontró token en Header ni Cookie.');
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }

  const result = await verifyKrouHubToken(token);

  if (!result.valid || !result.payload) {
    console.log('[API /api/auth/me] ❌ Token inválido:', result.error);
    return NextResponse.json(
      { authenticated: false, error: result.error, user: null },
      { status: 200 }
    );
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
    token,
  };

  console.log('[API /api/auth/me] ✅ Usuario verificado exitosamente:', responseBody.user.email, `(${responseBody.user.role})`);
  return NextResponse.json(responseBody);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token requerido' }, { status: 400 });
    }

    const result = await verifyKrouHubToken(token);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err?.message || 'Error del servidor' }, { status: 500 });
  }
}
