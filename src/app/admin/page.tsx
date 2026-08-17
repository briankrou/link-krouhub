'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { runConfigDiagnosticsAction } from '@/actions/config.actions';
import { getAuthLogsAction, clearAuthLogsAction, testTokenAction } from '@/actions/logs.actions';
import { AuthLogEntry, AuthStats } from '@/services/logService';

export type { AuthLogEntry, AuthStats };

export default function AdminConsolePage() {
  const [logs, setLogs] = useState<AuthLogEntry[]>([]);
  const [stats, setStats] = useState<AuthStats>({
    total: 0,
    validCount: 0,
    invalidCount: 0,
    mockCount: 0,
    avgDurationMs: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'VALID' | 'INVALID'>('ALL');
  const [selectedLog, setSelectedLog] = useState<AuthLogEntry | null>(null);

  // Tester State
  const [testTokenInput, setTestTokenInput] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Config Verifier State
  const [configResult, setConfigResult] = useState<any | null>(null);
  const [isCheckingConfig, setIsCheckingConfig] = useState<boolean>(false);

  const runConfigCheck = async (env: 'production' | 'local' = 'production') => {
    setIsCheckingConfig(true);
    try {
      const res = await runConfigDiagnosticsAction(env);
      if (res.success && res.data) {
        setConfigResult(res.data);
      }
    } catch (err) {
      console.error('Error al verificar configuración:', err);
    } finally {
      setIsCheckingConfig(false);
    }
  };

  const fetchLogs = useCallback(async () => {
    try {
      const res = await getAuthLogsAction();
      if (res.success && res.data) {
        setLogs(res.data.logs || []);
        setStats(res.data.stats || ({} as AuthStats));
      }
    } catch (err) {
      console.error('Error cargando logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClearLogs = async () => {
    try {
      const res = await clearAuthLogsAction();
      if (res.success && res.data) {
        setLogs(res.data.logs || []);
        setStats(res.data.stats || ({} as AuthStats));
      }
    } catch (err) {
      console.error('Error limpiando logs:', err);
    }
  };

  const handleTestToken = async (tokenToTest?: string) => {
    const token = tokenToTest || testTokenInput;
    if (!token.trim()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testTokenAction(token.trim());
      if (res.data) {
        if (res.data.testResult) setTestResult(res.data.testResult);
        if (res.data.logs) setLogs(res.data.logs);
        if (res.data.stats) setStats(res.data.stats);
      } else if (res.error) {
        setTestResult({ valid: false, error: res.error });
      }
    } catch (err: any) {
      setTestResult({ valid: false, error: err?.message || 'Error de conexión' });
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    runConfigCheck('production');
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const filteredLogs = logs.filter((l) => {
    if (filter === 'VALID') return l.valid;
    if (filter === 'INVALID') return !l.valid;
    return true;
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xl font-bold">
                🛠️
              </span>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  Consola de Administración KrouHub
                </h1>
                <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                  Monitor de peticiones y diagnóstico de verificación de tokens JWT (RS256 / JWKS)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-2 ${
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              {autoRefresh ? 'Auto-refresco (3s)' : 'Pausado'}
            </button>

            <button
              onClick={fetchLogs}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              🔄 Recargar
            </button>

            <Link
              href="/"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition"
            >
              ← Volver a la App
            </Link>
          </div>
        </div>

        {/* Métricas Principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-slate-400 font-medium">Total Evaluaciones</span>
            <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
            <span className="text-[10px] text-slate-500 font-mono">Peticiones registradas</span>
          </div>

          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-emerald-400 font-medium">Validaciones Exitosas</span>
            <p className="text-2xl font-black text-emerald-400 mt-1">{stats.validCount}</p>
            <span className="text-[10px] text-emerald-500/70 font-mono">
              {stats.total > 0 ? `${Math.round((stats.validCount / stats.total) * 100)}% de éxito` : '0%'}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-rose-500/30 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-rose-400 font-medium">Rechazos / Errores</span>
            <p className="text-2xl font-black text-rose-400 mt-1">{stats.invalidCount}</p>
            <span className="text-[10px] text-rose-500/70 font-mono">Expirados / no autorizados</span>
          </div>

          <div className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-indigo-400 font-medium">Latencia Promedio</span>
            <p className="text-2xl font-black text-indigo-300 mt-1">{stats.avgDurationMs} ms</p>
            <span className="text-[10px] text-indigo-400/70 font-mono">Tiempo de verificación</span>
          </div>
        </div>

        {/* Verificador y Diagnosticador de Configuración de Entornos */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚙️</span> Diagnóstico de Configuración de Entornos
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Verifica la alineación de variables, conectividad JWKS y endpoints de KrouHub en Producción y Local
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runConfigCheck('production')}
                disabled={isCheckingConfig}
                className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <span>🌐</span>
                {isCheckingConfig ? 'Verificando...' : 'Verificar Producción (krouhub.com)'}
              </button>
              <button
                type="button"
                onClick={() => runConfigCheck('local')}
                disabled={isCheckingConfig}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5"
              >
                <span>💻</span>
                {isCheckingConfig ? 'Verificando...' : 'Verificar Local'}
              </button>
            </div>
          </div>

          {configResult && (
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 font-bold uppercase rounded text-[10px] ${
                    configResult.environment === 'production' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    Entorno Evaluado: {configResult.environment}
                  </span>
                  <span className="text-slate-400 font-mono">Target: {configResult.targetKrouhubUrl}</span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-emerald-400 font-bold">✓ {configResult.summary.passed} Correctos</span>
                  <span className="text-amber-400 font-bold">⚠️ {configResult.summary.warnings} Advertencias</span>
                  <span className="text-rose-400 font-bold">❌ {configResult.summary.errors} Errores</span>
                </div>
              </div>

              {/* Grid de Estado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Panel 1: Endpoints HTTP Remotos */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-300 block text-xs">🌐 Conectividad con KrouHub Central:</span>
                  
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Endpoint JWKS Remoto:</span>
                      {configResult.jwksRemoteTest.reachable ? (
                        <span className="text-emerald-400 font-bold">✅ ALCANZABLE (HTTP {configResult.jwksRemoteTest.statusCode})</span>
                      ) : (
                        <span className="text-rose-400 font-bold">❌ FALLO ({configResult.jwksRemoteTest.error || 'Sin conexión'})</span>
                      )}
                    </div>
                    {configResult.jwksRemoteTest.keyId && (
                      <div className="text-[10px] text-slate-400 pl-2">
                        Key ID (kid): <span className="text-cyan-300">{configResult.jwksRemoteTest.keyId}</span> | Alg: <span className="text-cyan-300">{configResult.jwksRemoteTest.algorithm}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1 border-t border-slate-800/40">
                      <span className="text-slate-400">Endpoint Online Verify:</span>
                      {configResult.verifyRemoteTest.reachable ? (
                        <span className="text-emerald-400 font-bold">✅ ALCANZABLE (HTTP {configResult.verifyRemoteTest.statusCode})</span>
                      ) : (
                        <span className="text-rose-400 font-bold">❌ FALLO ({configResult.verifyRemoteTest.error || 'Sin conexión'})</span>
                      )}
                    </div>
                    {configResult.verifyRemoteTest.hasCors && (
                      <div className="text-[10px] text-emerald-400/80 pl-2">
                        ✓ Cabeceras CORS activas en servidor central
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel 2: Variables y Llaves Criptográficas */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-300 block text-xs">🔑 Banderas y Llaves Criptográficas:</span>
                  
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Modo Auth MOCK:</span>
                      {configResult.environment === 'production' && configResult.mockEnabled ? (
                        <span className="text-rose-400 font-bold">❌ ERROR (Activo en Prod)</span>
                      ) : configResult.mockEnabled ? (
                        <span className="text-emerald-400 font-bold">✓ Habilitado (Local)</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">✓ Desactivado (Seguro)</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">KROUHUB_CLIENT_SECRET:</span>
                      {configResult.securityStatus.hasClientSecret ? (
                        <span className="text-emerald-400 font-bold">✓ Configurado</span>
                      ) : (
                        <span className="text-rose-400 font-bold">❌ Faltante</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Probador / Diagnosticador de Tokens */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>🧪</span> Probador y Diagnosticador de JWT en Tiempo Real
            </h2>
            <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              Tool Slug Target: "link"
            </span>
          </div>

          <div className="space-y-3">
            <textarea
              value={testTokenInput}
              onChange={(e) => setTestTokenInput(e.target.value)}
              placeholder="Pega un token JWT aquí para diagnosticar la firma, expiración y permisos (ej. eyJhbGci...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 h-24 resize-none"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Preajustes rápidos:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTestTokenInput('mock_demo_token_admin');
                    handleTestToken('mock_demo_token_admin');
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg border border-indigo-500/20 font-mono cursor-pointer"
                >
                  ⚡ Admin Mock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestTokenInput('mock_demo_token_client');
                    handleTestToken('mock_demo_token_client');
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 font-mono cursor-pointer"
                >
                  👤 Cliente Mock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestTokenInput('invalid.jwt.token.string');
                    handleTestToken('invalid.jwt.token.string');
                  }}
                  className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg border border-rose-500/20 font-mono cursor-pointer"
                >
                  ❌ Token Inválido
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleTestToken()}
                disabled={isTesting || !testTokenInput.trim()}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                {isTesting ? 'Evaluando...' : '🔍 Diagnosticar Token'}
              </button>
            </div>
          </div>

          {/* Resultado del Diagnóstico */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-3 ${
                testResult.valid
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-2">
                  <span>{testResult.valid ? '✅' : '❌'}</span>
                  <span>{testResult.valid ? 'TOKEN VÁLIDO Y AUTORIZADO' : 'VERIFICACIÓN FALLIDA'}</span>
                </span>
                {testResult.error && <span className="text-rose-400 font-normal">{testResult.error}</span>}
              </div>

              {/* Trazas de pasos */}
              {testResult.logs && testResult.logs.length > 0 && (
                <div>
                  <span className="block font-semibold text-slate-300 mb-1">Pasos de verificación ejecutados:</span>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto">
                    {testResult.logs.map((logStr: string, idx: number) => (
                      <div key={idx}>{logStr}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payload resultante */}
              {testResult.payload && (
                <div>
                  <span className="block font-semibold text-slate-300 mb-1">Payload decodificado:</span>
                  <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                    {JSON.stringify(testResult.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabla de Registros en Tiempo Real */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>📜</span> Log de Peticiones y Evaluación en Vivo ({filteredLogs.length})
              </h2>
              <p className="text-xs text-slate-400">Historial reciente de verificaciones con latencia y método</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filter === 'ALL' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos ({logs.length})
                </button>
                <button
                  onClick={() => setFilter('VALID')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filter === 'VALID' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Exitosos ({stats.validCount})
                </button>
                <button
                  onClick={() => setFilter('INVALID')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filter === 'INVALID' ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Errores ({stats.invalidCount})
                </button>
              </div>

              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                🗑️ Limpiar
              </button>
            </div>
          </div>

          {/* Listado */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">Usuario / Email</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Latencia</th>
                  <th className="py-3 px-4 text-right">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Cargando registros...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No hay registros de verificación aun. Realiza peticiones o usa el diagnosticador superior.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase ${
                            log.method === 'ONLINE_KROUHUB'
                              ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                              : log.method === 'JWKS_OFFLINE'
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                              : log.method === 'LOCAL_MOCK'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {log.method}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-200">
                        {log.userEmail ? (
                          <div>
                            <span className="font-semibold">{log.userEmail}</span>
                            {log.userRole && (
                              <span className="ml-2 text-[10px] text-indigo-400">({log.userRole})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Desconocido / Sin token</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {log.valid ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            VÁLIDO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-rose-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            RECHAZADO
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-400">{log.durationMs} ms</td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-[11px] border border-slate-700 transition cursor-pointer"
                        >
                          Ver JSON
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Detalle JSON */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🔎</span> Detalle de Registro [{selectedLog.id}]
                </h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
                >
                  ×
                </button>
              </div>

              {/* Trazas */}
              <div>
                <span className="block text-xs font-semibold text-slate-400 mb-1">Secuencia de Pasos:</span>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 space-y-1 max-h-40 overflow-y-auto">
                  {selectedLog.logs?.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              </div>

              {/* Payload Completo */}
              <div>
                <span className="block text-xs font-semibold text-slate-400 mb-1">Payload JSON Completo:</span>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300 max-h-60 overflow-y-auto">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
