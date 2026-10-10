export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };
}

export interface ResolvedErrorArgs {
  err: Error | undefined;
  meta: Record<string, unknown> | undefined;
  reqId: string | undefined;
}
