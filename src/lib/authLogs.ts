export interface AuthLogEntry {
  id: string;
  timestamp: string;
  tokenSnippet: string;
  method: 'ONLINE_KROUHUB' | 'JWKS_OFFLINE' | 'LOCAL_MOCK' | 'INVALID_FORMAT' | 'EXPIRED' | 'UNAUTHORIZED_TOOL';
  valid: boolean;
  userEmail?: string;
  userRole?: string;
  toolSlug?: string;
  error?: string;
  durationMs: number;
  payload?: Record<string, any> | null;
  logs: string[];
}

const MAX_LOGS = 100;
const logStore: AuthLogEntry[] = [];

export function addAuthLog(entry: Omit<AuthLogEntry, 'id' | 'timestamp'>): AuthLogEntry {
  const fullEntry: AuthLogEntry = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  logStore.unshift(fullEntry);
  if (logStore.length > MAX_LOGS) {
    logStore.pop();
  }
  return fullEntry;
}

export function getAuthLogs(): AuthLogEntry[] {
  return [...logStore];
}

export function clearAuthLogs(): void {
  logStore.length = 0;
}

export function getAuthStats() {
  const total = logStore.length;
  const validCount = logStore.filter((l) => l.valid).length;
  const invalidCount = total - validCount;
  const mockCount = logStore.filter((l) => l.method === 'LOCAL_MOCK').length;
  const totalDuration = logStore.reduce((acc, l) => acc + (l.durationMs || 0), 0);
  const avgDurationMs = total > 0 ? Math.round(totalDuration / total) : 0;

  return {
    total,
    validCount,
    invalidCount,
    mockCount,
    avgDurationMs,
  };
}
