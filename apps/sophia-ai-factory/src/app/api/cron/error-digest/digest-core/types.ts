export const CRON_NAME = 'error-digest';
/** Daily — skip if ran within last 12 hours */
export const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;
export const ERROR_THRESHOLD = 10;

export interface ErrorRow {
  msg_class: string;
  fingerprint: string;
  c: number;
}

export interface D1Result {
  results: ErrorRow[];
}

export interface D1Binding {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => { all: () => Promise<D1Result> };
  };
}

export interface GlobalEnv {
  DB?: D1Binding;
}
