'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, isAuthenticated, isLoading, error, loginMock, logout, krouhubUrl } =
    useAuth();

  // Redirección automática si la sesión no está abierta
  useEffect(() => {
    if (!isLoading && !isAuthenticated && typeof window !== 'undefined') {
      const loginUrl = `${krouhubUrl}/login?redirect=${encodeURIComponent(window.location.href)}`;
      console.log('[Home] 🔒 Sesión no detectada. Redirigiendo automáticamente a KrouHub Central:', loginUrl);
      window.location.href = loginUrl;
    }
  }, [isLoading, isAuthenticated, krouhubUrl]);



  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-5xl mx-auto w-full">
      <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-xl">
        <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>🛡️</span> Estado de Autenticación
          </span>
          {isAuthenticated && (
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
              ● Sesión Activa
            </span>
          )}
        </h2>

        {isLoading ? (
          <div className="py-8 text-center text-slate-400 animate-pulse flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Verificando credenciales con KrouHub...</span>
          </div>
        ) : isAuthenticated && user ? (
          <div className="space-y-6">
            {/* Tarjeta de Usuario Validado */}
            <div className="bg-slate-950 border border-indigo-500/30 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {user.name || 'Usuario KrouHub'}
                    <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {user.role}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">{user.email}</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {user.id}</p>
                </div>
              </div>

              <a
                href="/logout"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/20 transition self-end sm:self-center cursor-pointer flex items-center justify-center"
              >
                Cerrar Sesión
              </a>
            </div>

            {/* Herramientas Permitidas */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Herramientas Autorizadas (`allowed_tools`):
              </h4>
              <div className="flex flex-wrap gap-2">
                {user.allowedTools?.map((toolSlug: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 text-xs rounded-md bg-slate-800 text-indigo-300 border border-slate-700 font-mono"
                  >
                    ✓ {toolSlug}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl text-left max-w-md mx-auto mb-4 flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <div>
                  <strong className="font-semibold block mb-0.5">Aviso de Sesión:</strong>
                  {error}
                </div>
              </div>
            )}

            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-2xl">
              🔒
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Sesión no iniciada o expirada</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Para acceder a las funciones del acortador y creador de UTMs, debes iniciar sesión con tu cuenta de KrouHub.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`${krouhubUrl}/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
              >
                <span>Iniciar Sesión en KrouHub.com</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>

              <button
                onClick={() => loginMock('ADMIN')}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                🧪 Probar con Usuario Demo (Local)
              </button>
            </div>
          </div>
        )}
      </div>

    </main>
  );
}
