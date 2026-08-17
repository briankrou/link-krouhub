'use server';

import { runEnvironmentDiagnostics, DiagnosticResult } from '@/services/configService';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server Action: Valida el parámetro de entorno y ejecuta el diagnóstico de configuración HTTP y JWKS.
 */
export async function runConfigDiagnosticsAction(
  envInput?: string
): Promise<ActionResponse<DiagnosticResult>> {
  const env = (envInput || 'production').toLowerCase().trim();

  if (env !== 'production' && env !== 'prod' && env !== 'local' && env !== 'dev') {
    return {
      success: false,
      error: 'El parámetro de entorno debe ser "production" o "local".',
    };
  }

  try {
    const data = await runEnvironmentDiagnostics(env);
    return {
      success: true,
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error al ejecutar el diagnóstico de configuración.',
    };
  }
}
