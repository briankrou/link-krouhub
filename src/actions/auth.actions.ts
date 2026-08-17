'use server';

import { verifyKrouHubToken, VerificationResult } from '@/services/authService';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server Action: Valida el parámetro de token recibido y ejecuta la verificación con KrouHub auth service.
 */
export async function verifyTokenAction(token: string): Promise<ActionResponse<VerificationResult>> {
  if (typeof token !== 'string') {
    return {
      success: false,
      error: 'El token enviado debe ser una cadena de texto.',
    };
  }

  const sanitizedToken = token.trim();
  if (!sanitizedToken) {
    return {
      success: false,
      error: 'El token no puede estar vacío.',
    };
  }

  try {
    const result = await verifyKrouHubToken(sanitizedToken);
    return {
      success: result.valid,
      data: result,
      error: result.valid ? undefined : result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error interno al procesar verificación del token.',
    };
  }
}
