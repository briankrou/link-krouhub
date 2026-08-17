'use server';

import { getAuthLogs, clearAuthLogs, getAuthStats, AuthLogEntry, AuthStats } from '@/services/logService';
import { verifyKrouHubToken, VerificationResult } from '@/services/authService';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LogsAndStatsData {
  logs: AuthLogEntry[];
  stats: AuthStats;
  testResult?: VerificationResult;
}

/**
 * Server Action: Obtiene el listado actual de logs y estadísticas de autenticación.
 */
export async function getAuthLogsAction(): Promise<ActionResponse<LogsAndStatsData>> {
  try {
    return {
      success: true,
      data: {
        logs: getAuthLogs(),
        stats: getAuthStats(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Fallo al obtener los registros de autenticación.',
    };
  }
}

/**
 * Server Action: Limpia el almacén de logs de autenticación.
 */
export async function clearAuthLogsAction(): Promise<ActionResponse<LogsAndStatsData>> {
  try {
    clearAuthLogs();
    return {
      success: true,
      data: {
        logs: getAuthLogs(),
        stats: getAuthStats(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Fallo al limpiar los registros.',
    };
  }
}

/**
 * Server Action: Valida el parámetro del token de prueba y ejecuta la traza registrándola en los logs.
 */
export async function testTokenAction(token: string): Promise<ActionResponse<LogsAndStatsData>> {
  if (typeof token !== 'string') {
    return {
      success: false,
      error: 'El token de prueba debe ser una cadena de texto.',
    };
  }

  const sanitizedToken = token.trim();
  if (!sanitizedToken) {
    return {
      success: false,
      error: 'Proporciona un token para realizar la prueba.',
    };
  }

  try {
    const testResult = await verifyKrouHubToken(sanitizedToken);
    return {
      success: testResult.valid,
      data: {
        testResult,
        logs: getAuthLogs(),
        stats: getAuthStats(),
      },
      error: testResult.valid ? undefined : testResult.error,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error al diagnosticar token.',
    };
  }
}
