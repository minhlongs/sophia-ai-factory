/**
 * B05/B08: an error is not zero earnings, a failed kill-switch read is not
 * "off", and multi-currency totals are never collapsed into one USD figure.
 */
import { describe, it, expect } from 'vitest';
import {
  DASHBOARD_STATE_COPY,
  effectiveCommissionByCurrency,
  resolveDashboardViewState,
} from '../dashboard-load-state';
import { computeDomainBReconciliation } from '../../reconciliation/workspace-domain-b-reconciliation';

describe('resolveDashboardViewState', () => {
  it('distinguishes unauthenticated, unconnected, empty, error and ready', () => {
    expect(resolveDashboardViewState({ authenticated: false, dbAvailable: false, queryOk: false, killSwitchKnown: false }).state).toBe('unauthenticated');
    expect(resolveDashboardViewState({ authenticated: true, dbAvailable: false, queryOk: false, killSwitchKnown: false }).state).toBe('unconnected');
    expect(resolveDashboardViewState({ authenticated: true, dbAvailable: true, queryOk: true, killSwitchKnown: true, summary: undefined }).state).toBe('empty');
    expect(resolveDashboardViewState({ authenticated: true, dbAvailable: true, queryOk: false, killSwitchKnown: true }).state).toBe('error');
    expect(resolveDashboardViewState({ authenticated: true, dbAvailable: true, queryOk: true, killSwitchKnown: false }).state).toBe('error');
  });

  it('never turns an error into a financial figure', () => {
    const error = resolveDashboardViewState({ authenticated: true, dbAvailable: true, queryOk: false, killSwitchKnown: true });
    expect(error.financialsAvailable).toBe(false);
    expect(DASHBOARD_STATE_COPY.error.en).toContain('not zero');
  });

  it('refuses a single headline total for a multi-currency ledger', () => {
    const summary = computeDomainBReconciliation('ws_a', [
      { id: '1', tenantId: 'ws_a', network: 'partnerstack', externalTxId: 'a', grossAmountCents: 0, commissionCents: 1000, status: 'paid_receipt', currency: 'USD', occurredAt: 1 },
      { id: '2', tenantId: 'ws_a', network: 'bybit', externalTxId: 'b', grossAmountCents: 0, commissionCents: 2000, status: 'paid_receipt', currency: 'USDT', occurredAt: 2 },
    ]);
    const view = resolveDashboardViewState({ authenticated: true, dbAvailable: true, queryOk: true, killSwitchKnown: true, summary });
    expect(view.state).toBe('ready');
    expect(view.financialsAvailable).toBe(false);
    expect(view.currencies).toEqual(['USD', 'USDT']);
    expect(effectiveCommissionByCurrency(summary)).toEqual([
      { currency: 'USD', amount: 10 },
      { currency: 'USDT', amount: 20 },
    ]);
  });
});
