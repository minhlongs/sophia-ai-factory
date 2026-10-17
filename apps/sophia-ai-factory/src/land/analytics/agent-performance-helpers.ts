/**
 * Analytics — Agent Performance Types & Pivot Helpers
 */

export type WindowOption = '24h' | '7d';

export interface AgentRoleMetrics {
  role: string;
  variant: string;
  start_count: number;
  complete_count: number;
  fail_count: number;
  /** Completion rate 0–1 (complete / start), null if no starts */
  completion_rate: number | null;
  /** Average duration in ms for completed tasks, null if none */
  avg_duration_ms: number | null;
}

export interface AgentPerformanceReport {
  window: WindowOption;
  generated_at: string;
  roles: AgentRoleMetrics[];
}

export interface AggRow {
  role: string | null;
  event_type: string | null;
  count: number | string;
  avg_duration_ms: number | string | null;
}

/** Returns unix ms timestamp for the start of the given window */
export function windowStart(window: WindowOption): number {
  const hours = window === '24h' ? 24 : 7 * 24;
  return Date.now() - hours * 60 * 60 * 1000;
}

export function toInt(v: unknown): number {
  if (typeof v === 'number') return Math.round(v);
  if (typeof v === 'string') return parseInt(v, 10) || 0;
  return 0;
}

export function toFloatOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  return null;
}

export function pivotRowsToRoleMetrics(rows: AggRow[]): AgentRoleMetrics[] {
  const roleMap = new Map<string, AgentRoleMetrics>();

  for (const row of rows) {
    const roleName = row.role ?? 'unknown';
    if (!roleMap.has(roleName)) {
      roleMap.set(roleName, {
        role: roleName,
        variant: 'control',
        start_count: 0,
        complete_count: 0,
        fail_count: 0,
        completion_rate: null,
        avg_duration_ms: null,
      });
    }

    const entry = roleMap.get(roleName)!;
    const count = toInt(row.count);

    switch (row.event_type) {
      case 'agent_task_start':
        entry.start_count = count;
        break;
      case 'agent_task_complete':
        entry.complete_count = count;
        entry.avg_duration_ms = toFloatOrNull(row.avg_duration_ms);
        break;
      case 'agent_task_fail':
        entry.fail_count = count;
        break;
    }
  }

  for (const entry of roleMap.values()) {
    entry.completion_rate =
      entry.start_count > 0 ? entry.complete_count / entry.start_count : null;
  }

  return Array.from(roleMap.values());
}
