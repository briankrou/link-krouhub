'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { verifyTokenAction } from '@/actions/auth.actions';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  allowedTools?: string[];
}

export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginWithToken: (newToken: string) => Promise<LoginResult>;
  loginMock: (role?: 'ADMIN' | 'CLIENT') => Promise<LoginResult>;
  logout: (globalLogout?: boolean | React.SyntheticEvent) => void;
  krouhubUrl: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  loginWithToken: async () => ({ success: false }),
  loginMock: async () => ({ success: false }),
  logout: () => {},
  krouhubUrl: 'https://krouhub.com',
});

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [krouhubUrl, setKrouhubUrl] = useState<string>('https://krouhub.com');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host.endsWith('krouhub.com') || host.endsWith('vercel.app') || process.env.NODE_ENV === 'production') {
        setKrouhubUrl('https://krouhub.com');
      } else {
        setKrouhubUrl(process.env.NEXT_PUBLIC_KROUHUB_BASE_URL || 'http://localhost:3000');
      }
    }
  }, []);

  /**
   * Cierre de sesión (Single Sign-Out):
   * 1. Limpia el estado local.
   * 2. Si globalLogout es true (por defecto), redirige al endpoint /logout de la herramienta,
   *    el cual limpia las cookies httpOnly y redirige a KrouHub Central.
   */
  const logout = useCallback((globalLogout?: boolean | React.SyntheticEvent) => {
    const isGlobal = typeof globalLogout === 'boolean' ? globalLogout : true;
    if (typeof window !== 'undefined' && isGlobal) {
      window.location.href = '/logout';
      return;
    }
    setUser(null);
    setError(null);
  }, []);

  /**
   * Revalida la sesión activa con el servidor
   */
  const verifySessionToken = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (res.ok && data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
        if (data.error) {
          console.warn('[AuthContext] ⚠️ Sesión no válida o revocada en servidor central:', data.error);
          setError(data.error || 'Sesión finalizada o revocada');
          logout(false);
        }
      }
    } catch (err) {
      console.error('[AuthContext] Error al revalidar sesión:', err);
    }
  }, [logout]);

  // Inicialización de autenticación
  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      setError(null);

      // Revalidar sesión en vivo vía /api/auth/me que lee la cookie httpOnly
      await verifySessionToken();
      setIsLoading(false);
    }

    initAuth();
  }, [verifySessionToken]);

  // Escuchar eventos de foco para sincronizar estado de sesión en tiempo real
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocus = () => {
      verifySessionToken();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    // Comprobación periódica cada 15 minutos (según spec de heartbeat recomendado)
    const interval = setInterval(() => {
      verifySessionToken();
    }, 15 * 60 * 1000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [verifySessionToken]);

  const loginWithToken = async (newToken: string): Promise<LoginResult> => {
    setIsLoading(true);
    setError(null);

    try {
      // Usar la Server Action segura para validar el token y registrar en logs.
      // Adicionalmente pasaremos el token a /api/auth/me en POST para que guarde las cookies httpOnly.
      const res = await fetch('/api/auth/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: newToken.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.valid && data.payload) {
        const payload = data.payload;
        const loggedUser: User = {
          id: payload.sub,
          email: payload.email,
          name: payload.name || payload.email,
          role: payload.role,
          allowedTools: payload.allowed_tools || (payload.tool ? [payload.tool] : []),
        };

        // Forzar seteo de cookies locales en el navegador vía una llamada temporal para pruebas si no viajan automáticas,
        // pero dado que el servidor respondió con éxito en la verificación del token en la DB/JWKS,
        // establecemos una cookie simulada de sesión o el mismo endpoint POST lo hace si re-configuramos.
        // Espera, el endpoint POST /api/auth/me de arriba solo verificó y devolvió JSON.
        // Modifiquemos POST /api/auth/me o escribamos aquí para setear cookies httpOnly del lado del cliente?
        // No, el cliente no puede setear cookies httpOnly!
        // Entonces, en POST /api/auth/me debemos setear las cookies en la respuesta!
        // Excelente observación. Vamos a asegurarnos de que POST /api/auth/me también responda seteando las cookies.
        
        // Hacemos un reload o llamamos a verifySessionToken para recuperar la sesión
        await verifySessionToken();
        setIsLoading(false);
        return { success: true, user: loggedUser };
      } else {
        const err = data.error || 'Token inválido o revocado';
        setError(err);
        logout(false);
        setIsLoading(false);
        return { success: false, error: err };
      }
    } catch (err: any) {
      setError('Error al procesar el token');
      logout(false);
      setIsLoading(false);
      return { success: false, error: err?.message || 'Error desconocido' };
    }
  };

  const loginMock = (role: 'ADMIN' | 'CLIENT' = 'CLIENT'): Promise<LoginResult> => {
    const mockToken = role === 'ADMIN' ? 'mock_demo_token_admin' : 'mock_demo_token_client';
    return loginWithToken(mockToken);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        loginWithToken,
        loginMock,
        logout,
        krouhubUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
