import { NextRequest, NextResponse } from 'next/server';
import { runEnvironmentDiagnostics } from '@/services/configService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetEnv = searchParams.get('env') || 'production';

  try {
    const result = await runEnvironmentDiagnostics(targetEnv);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Error al ejecutar diagnóstico de configuración' },
      { status: 500 }
    );
  }
}
