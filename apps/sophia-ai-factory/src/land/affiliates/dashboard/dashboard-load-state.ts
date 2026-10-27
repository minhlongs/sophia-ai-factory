/**
 * Honest dashboard view-state resolution for external affiliate earnings.
 *
 * An error is NEVER rendered as "0.00 earned" and a failed kill-switch read is
 * NEVER rendered as "off". Multi-currency ledgers are presented per currency,
 * never as one fake USD total.
 *
 * Layer: land/affiliates/dashboard
 * @module land/affiliates/dashboard/dashboard-load-state
 */

import type { DomainBReconciliationSummary } from '../reconciliation/workspace-domain-b-reconciliation';

export type DashboardLoadState =
  | 'unauthenticated'
  | 'unconnected'
  | 'empty'
  | 'ready'
  | 'error';

export interface DashboardStateInput {
  authenticated: boolean;
  dbAvailable: boolean;
  queryOk: boolean;
  killSwitchKnown: boolean;
  summary?: DomainBReconciliationSummary;
  error?: string;
}

export interface DashboardViewState {
  state: DashboardLoadState;
  /** Human-readable reason, safe to display (no secrets / raw stack traces). */
  reason?: string;
  /** Only true when a single currency makes a headline figure meaningful. */
  financialsAvailable: boolean;
  currencies: string[];
}

export function resolveDashboardViewState(input: DashboardStateInput): DashboardViewState {
  if (!input.authenticated) {
    return { state: 'unauthenticated', financialsAvailable: false, currencies: [] };
  }
  if (!input.dbAvailable) {
    return { state: 'unconnected', reason: 'Workspace database binding is not available', financialsAvailable: false, currencies: [] };
  }
  if (!input.queryOk || !input.killSwitchKnown) {
    return {
      state: 'error',
      reason: input.queryOk ? 'Safety switch state could not be read' : 'Commission ledger could not be read',
      financialsAvailable: false,
      currencies: [],
    };
  }
  const summary = input.summary;
  const currencies = summary?.currencies ?? (summary ? Object.keys(summary.byCurrency) : []);
  const hasRows = Object.keys(summary?.byCurrency ?? {}).length > 0;
  if (!hasRows) {
    return { state: 'empty', financialsAvailable: false, currencies: [] };
  }
  return {
    state: 'ready',
    financialsAvailable: summary?.totalsAvailable ?? currencies.length <= 1,
    currencies,
  };
}

/** Per-currency effective commission, in major units. No FX conversion. */
export function effectiveCommissionByCurrency(
  summary: DomainBReconciliationSummary,
): Array<{ currency: string; amount: number }> {
  return Object.values(summary.byCurrency)
    .map((entry) => ({ currency: entry.currency, amount: entry.effectiveCommissionCents / 100 }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export const DASHBOARD_STATE_COPY: Record<DashboardLoadState, { en: string; vi: string }> = {
  unauthenticated: { en: 'Sign in to see workspace earnings.', vi: 'Đăng nhập để xem thu nhập workspace.' },
  unconnected: { en: 'No workspace data source connected yet.', vi: 'Chưa kết nối nguồn dữ liệu workspace.' },
  empty: { en: 'No commission statements recorded yet.', vi: 'Chưa có sao kê hoa hồng nào.' },
  ready: { en: 'Workspace commission', vi: 'Hoa hồng workspace' },
  error: { en: 'Earnings are unavailable right now — this is not zero.', vi: 'Không đọc được thu nhập lúc này — đây không phải số không.' },
};
