import type { AuditLedgerRecord } from '@/seed/types/agent-governance';

export interface D1Like {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      run(): Promise<unknown>;
      first<T = Record<string, unknown>>(): Promise<T | undefined>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] } | T[]>;
    };
    run(): Promise<unknown>;
    first<T = Record<string, unknown>>(): Promise<T | undefined>;
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] } | T[]>;
  };
}

export interface QueryAuditLedgerOptions {
  agentId?: string;
  allowed?: boolean;
  limit?: number;
  offset?: number;
}

export interface QueryAuditLedgerResponse {
  success: boolean;
  data?: {
    records: AuditLedgerRecord[];
    total: number;
  };
  error?: string;
}

export interface AuditLedgerRow {
  id: string;
  agency_id: string;
  agent_id: string;
  action: string;
  requested_autonomy: string;
  max_autonomy?: string | null;
  required_autonomy?: string | null;
  requested_compute?: number;
  requested_compute_units?: number;
  allowed: number;
  reason: string;
  escalation_triggered: number;
  evaluation_sha256: string;
  metadata_json?: string;
  created_at: number;
}
