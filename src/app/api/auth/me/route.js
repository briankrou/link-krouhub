import { NextResponse } from 'next/server';
import { verifyKrouHubToken } from '@/lib/krouhubAuth';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = request.cookies.get('krouhub_token')?.value;
  }

  if (!token) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }

  const result = await verifyKrouHubToken(token);

  if (!result.valid) {
    return NextResponse.json(
      { authenticated: false, error: result.error, user: null },
      { status: 200 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: result.payload.sub,
      email: result.payload.email,
      name: result.payload.name,
      role: result.payload.role,
      allowedTools: result.payload.allowed_tools || [result.payload.tool],
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token requerido' }, { status: 400 });
    }

    const result = await verifyKrouHubToken(token);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ valid: false, error: err.message }, { status: 500 });
  }
}
