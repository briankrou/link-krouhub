'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function KrouHubAuthBar() {
  const { user, isAuthenticated, isLoading, logout, loginWithToken, loginMock, krouhubUrl } =
    useAuth();
  const [showModal, setShowModal] = useState<boolean>(false);
  const [customToken, setCustomToken] = useState<string>('');
  const [inputError, setInputError] = useState<string>('');

  const handleCustomTokenSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!customToken.trim()) return;

    setInputError('');
    const res = await loginWithToken(customToken.trim());
    if (res.success) {
      setShowModal(false);
      setCustomToken('');
    } else {
      setInputError(res.error || 'Token inválido o expirado.');
    }
  };

  const handleMockLogin = async (role: 'ADMIN' | 'CLIENT') => {
    setInputError('');
    const res = await loginMock(role);
    if (res.success) {
      setShowModal(false);
    }
  };

  return (
    <div className="w-full bg-slate-900/90 border-b border-indigo-500/20 backdrop-blur-md px-4 py-2.5 text-white flex items-center justify-between text-xs sm:text-sm">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-bold text-white text-[11px] shadow-sm">
            K
          </div>
          <span className="font-semibold text-slate-200 tracking-wide">KrouHub Auth System</span>
        </div>

        <span className="text-slate-600">|</span>

        {(() => {
          if (isLoading) {
            return (
              <span className="text-slate-400 animate-pulse flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                Verificando sesión...
              </span>
            );
          }
          if (isAuthenticated && user) {
            return (
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                <span className="text-slate-300">
                  Conectado como <strong className="text-indigo-300 font-medium">{user.name || user.email}</strong>
                </span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {user.role}
                </span>
              </div>
            );
          }
          return (
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-slate-400">Sin sesión activa</span>
            </div>
          );
        })()}
      </div>

      <div className="flex items-center space-x-2">
        <Link
          href="/admin"
          className="px-2.5 py-1 text-xs rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1 cursor-pointer font-medium"
        >
          <span>🛠️ Consola Admin</span>
        </Link>

        {isAuthenticated ? (
          <button
            onClick={logout}
            className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            Cerrar Sesión
          </button>
        ) : (
          <>
            <a
              href={`${krouhubUrl}/login`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition flex items-center gap-1"
            >
              <span>Iniciar Sesión en KrouHub</span>
              <svg className="w-3.5 h-3.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
            >
              Token / Dev Mock
            </button>
          </>
        )}
      </div>

      {/* Modal para Ingreso de Token o Pruebas Locales */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl text-left">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="text-indigo-400">🔑</span> Autenticación KrouHub (JWT / Local)
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Ingresa un JWT válido emitido por KrouHub (RS256) o selecciona un usuario simulado para pruebas en desarrollo.
            </p>

            <form onSubmit={handleCustomTokenSubmit} className="mb-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Token JWT (Bearer Token)
              </label>
              <textarea
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
                placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono h-24 resize-none mb-2"
              />
              {inputError && <p className="text-xs text-rose-400 mb-2">{inputError}</p>}
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition cursor-pointer"
              >
                Validar Token JWT
              </button>
            </form>

            <div className="pt-4 border-t border-slate-800">
              <span className="block text-xs font-medium text-slate-400 mb-2">
                Modo Pruebas / Desarrollo Local:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleMockLogin('CLIENT')}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs transition font-medium cursor-pointer"
                >
                  👤 Login como Cliente
                </button>
                <button
                  onClick={() => handleMockLogin('ADMIN')}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs transition font-medium cursor-pointer"
                >
                  ⚡ Login como Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
