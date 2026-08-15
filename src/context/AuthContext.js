'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  loginWithToken: () => {},
  loginMock: () => {},
  logout: () => {},
  krouhubUrl: '',
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const krouhubUrl =
    process.env.NEXT_PUBLIC_KROUHUB_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://krouhub.com' : 'http://localhost:3001');

  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      setError(null);

      let activeToken = null;

      // 1. Revisar si viene token en la URL (ej: https://link.krouhub.com/?token=...)
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenParam = urlParams.get('token');

        if (tokenParam) {
          activeToken = tokenParam;
          localStorage.setItem('krouhub_token', tokenParam);
          document.cookie = `krouhub_token=${tokenParam}; path=/; max-age=${60 * 60 * 24 * 7}`;

          // Limpiar la URL sin recargar la página
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } else {
          // 2. Intentar leer desde localStorage
          activeToken = localStorage.getItem('krouhub_token');
        }
      }

      if (!activeToken) {
        setIsLoading(false);
        return;
      }

      setToken(activeToken);

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
        });

        const data = await res.json();

        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          // Si el token es inválido o expiró
          setError(data.error || 'Sesión expirada');
          setUser(null);
          setToken(null);
          localStorage.removeItem('krouhub_token');
          document.cookie = 'krouhub_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
      } catch (err) {
        console.error('[Auth] Error al verificar sesión:', err);
        setError('Error al conectar con el servidor de autenticación');
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const loginWithToken = async (newToken) => {
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

      if (data.authenticated && data.user) {
        setUser(data.user);
        setIsLoading(false);
        return { success: true, user: data.user };
      } else {
        setError(data.error || 'Token inválido');
        setUser(null);
        setIsLoading(false);
        return { success: false, error: data.error };
      }
    } catch (err) {
      setError('Error al procesar el token');
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  };

  const loginMock = (role = 'CLIENT') => {
    const mockToken = role === 'ADMIN' ? 'mock_demo_token_admin' : 'mock_demo_token_client';
    return loginWithToken(mockToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setError(null);
    localStorage.removeItem('krouhub_token');
    document.cookie = 'krouhub_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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

export function useAuth() {
  return useContext(AuthContext);
}
