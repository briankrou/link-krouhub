'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

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
  token: string | null;
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
  token: null,
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
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [krouhubUrl, setKrouhubUrl] = useState<string>('https://krouhub.com');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host.endsWith('krouhub.com') || host.endsWith('vercel.app') || process.env.NODE_ENV === 'production') {
        setKrouhubUrl('https://krouhub.com');
      } else {
        setKrouhubUrl(process.env.NEXT_PUBLIC_KROUHUB_URL || 'http://localhost:3000');
      }
    }
  }, []);

  /**
   * Cierre de sesión (Single Sign-Out):
   * 1. Limpia token y cookie localmente.
   * 2. Si globalLogout es true (por defecto), redirige al endpoint /logout-redirect de KrouHub.
   */
  const logout = useCallback((globalLogout?: boolean | React.SyntheticEvent) => {
    const isGlobal = typeof globalLogout === 'boolean' ? globalLogout : true;
    setUser(null);
    setToken(null);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('krouhub_token');
      document.cookie = 'krouhub_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

      if (isGlobal) {
        window.location.href = `${krouhubUrl}/logout-redirect`;
      }
    }
  }, [krouhubUrl]);

  /**
   * Revalida la sesión activa con el servidor
   */
  const verifySessionToken = useCallback(async (activeToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });

      const data = await res.json();

      if (res.ok && data.authenticated && data.user) {
        setUser(data.user);
        setToken(activeToken);
      } else {
        console.log('[AuthContext] ⚠️ Sesión no válida o revocada en servidor central (error:', data.error, '). Cerrando sesión local...');
        setError(data.error || 'Sesión finalizada o revocada');
        logout(false);
      }
    } catch (err) {
      console.error('[AuthContext] Error al revalidar sesión:', err);
      setError('Error de comunicación con el servidor de autenticación');
      logout(false);
    }
  }, [logout]);

  // Inicialización de autenticación
  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      setError(null);

      let activeToken: string | null = null;

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenParam = urlParams.get('token');

        if (tokenParam) {
          console.log('[AuthContext] 🔑 Token detectado en URL (?token=...):', `${tokenParam.substring(0, 25)}...`);
          activeToken = tokenParam;
          localStorage.setItem('krouhub_token', tokenParam);
          document.cookie = `krouhub_token=${tokenParam}; path=/; max-age=${60 * 60 * 24 * 7}`;

          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } else {
          activeToken = localStorage.getItem('krouhub_token');
        }
      }

      if (!activeToken) {
        setIsLoading(false);
        return;
      }

      await verifySessionToken(activeToken);
      setIsLoading(false);
    }

    initAuth();
  }, [verifySessionToken]);

  // Escuchar eventos de cambio de foco (regreso a la pestaña) y almacenamiento local para sincronizar cierre de sesión
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocus = () => {
      const currentToken = localStorage.getItem('krouhub_token');
      if (!currentToken && user) {
        console.log('[AuthContext] 📢 Token no encontrado al cambiar de ventana. Cerrando sesión local...');
        logout(false);
      } else if (currentToken) {
        verifySessionToken(currentToken);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'krouhub_token' && !e.newValue) {
        console.log('[AuthContext] 📢 Evento storage: Token eliminado en otra pestaña.');
        logout(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('storage', handleStorageChange);

    // Comprobación periódica cada 30 segundos
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('krouhub_token');
      if (currentToken) {
        verifySessionToken(currentToken);
      } else if (user) {
        logout(false);
      }
    }, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user, logout, verifySessionToken]);

  const loginWithToken = async (newToken: string): Promise<LoginResult> => {
    setIsLoading(true);
    setError(null);
    setToken(newToken);

    localStorage.setItem('krouhub_token', newToken);
    document.cookie = `krouhub_token=${newToken}; path=/; max-age=${60 * 60 * 24 * 7}`;

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${newToken}`,
        },
      });

      const data = await res.json();

      if (res.ok && data.authenticated && data.user) {
        setUser(data.user);
        setIsLoading(false);
        return { success: true, user: data.user };
      } else {
        setError(data.error || 'Token inválido o revocado');
        logout(false);
        setIsLoading(false);
        return { success: false, error: data.error || 'Token inválido o revocado' };
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
        token,
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
