import { NextRequest, NextResponse } from 'next/server';
import { getAuthLogs, getAuthStats, clearAuthLogs } from '@/services/logService';
import { verifyKrouHubToken } from '@/services/authService';

export async function GET() {
  return NextResponse.json({
    logs: getAuthLogs(),
    stats: getAuthStats(),
  });
}

export async function DELETE() {
  clearAuthLogs();
  return NextResponse.json({
    message: 'Registros de autenticación limpiados correctamente.',
    logs: getAuthLogs(),
    stats: getAuthStats(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token es requerido para pruebas' }, { status: 400 });
    }

    const result = await verifyKrouHubToken(token);

    return NextResponse.json({
      result,
      logs: getAuthLogs(),
      stats: getAuthStats(),
    });
  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err?.message || 'Error al procesar token' }, { status: 500 });
  }
}
