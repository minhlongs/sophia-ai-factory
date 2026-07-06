/**
 * Operator entity configuration for Solo Company Media handover.
 * Stored as application default; changes require deploy restart.
 *
 * @module tree/handover/operator-config
 */

export interface OperatorConfig {
  companyName: string;
  contactName: string;
  contactEmail: string;
  role: 'platform_operator';
  revenueSharePct: number;
}

export const DEFAULT_OPERATOR_CONFIG: OperatorConfig = {
  companyName: 'Solo Company Media',
  contactName: 'Long Tho',
  contactEmail: '',
  role: 'platform_operator',
  revenueSharePct: 100,
};

/** Returns the operator config. Reads from KV if configured, else default. */
export async function getOperatorConfig(remote?: unknown): Promise<OperatorConfig> {
  if (remote && typeof remote === 'object' && 'KV' in remote) {
    try {
      const kv = (remote as { KV: unknown }).KV;
      const getFn = (kv as { get?: (k: string) => Promise<string | null> }).get;
      const raw = typeof getFn === 'function' ? await getFn('operator_config') : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<OperatorConfig>;
        return { ...DEFAULT_OPERATOR_CONFIG, ...parsed };
      }
    } catch {
      // KV read failed — fall through to default
    }
  }
  return DEFAULT_OPERATOR_CONFIG;
}
