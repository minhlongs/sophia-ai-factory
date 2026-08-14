'use client';

/**
 * AdminBillingClient — admin billing dashboard.
 * Fetches /api/admin/billing/summary and /api/admin/billing/overage-events.
 * Includes dunning search and actions.
 */

import { useState, useEffect, useCallback } from 'react';
import type { BillingSummary, OverageEvent, DunningState } from './admin-billing-types';
import { renderHeader, renderError, renderSummaryKPIs } from './admin-billing-summary-kpi';
import { renderDunningSection } from './admin-billing-dunning-section';
import { renderOverageTable } from './admin-billing-overages-table';

export function AdminBillingClient({
  initialSummary,
}: {
  initialSummary?: BillingSummary;
}): React.JSX.Element {
  const [summary, setSummary] = useState<BillingSummary | null>(initialSummary ?? null);
  const [overages, setOverages] = useState<OverageEvent[]>([]);
  const [loading, setLoading] = useState(!initialSummary);
  const [error, setError] = useState<string | null>(null);

  const [dunningSearch, setDunningSearch] = useState('');
  const [dunningResult, setDunningResult] = useState<DunningState | null>(null);
  const [dunningLoading, setDunningLoading] = useState(false);
  const [dunningError, setDunningError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, overagesRes] = await Promise.all([
        fetch('/api/admin/billing/summary', { cache: 'no-store' }),
        fetch('/api/admin/billing/overage-events?limit=20', { cache: 'no-store' }),
      ]);
      if (summaryRes.ok) setSummary((await summaryRes.json()) as BillingSummary);
      if (overagesRes.ok) {
        const data = (await overagesRes.json()) as OverageEvent[] | { events?: OverageEvent[] };
        setOverages(Array.isArray(data) ? data : data.events ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!initialSummary) fetchSummary(); }, [initialSummary, fetchSummary]);

  async function searchDunning() {
    if (!dunningSearch.trim()) return;
    setDunningLoading(true);
    setDunningError(null);
    setDunningResult(null);
    try {
      const res = await fetch(`/api/admin/dunning/${encodeURIComponent(dunningSearch.trim())}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setDunningResult((await res.json()) as DunningState);
    } catch (err) {
      setDunningError(err instanceof Error ? err.message : 'Failed to fetch dunning state');
    } finally {
      setDunningLoading(false);
    }
  }

  async function handleDunningAction(nonce: string, action: 'suspend' | 'restore') {
    setActionBusy(`${nonce}:${action}`);
    try {
      const res = await fetch(`/api/admin/dunning/${encodeURIComponent(nonce)}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      if (dunningResult?.nonce === nonce.slice(0, 8)) await searchDunning();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionBusy(null);
    }
  }

  function fmtCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  function fmtDate(ts: string | null): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-6">
      {renderHeader(loading, fetchSummary)}
      {renderError(error)}
      {summary && renderSummaryKPIs(summary, fmtCurrency)}
      {renderDunningSection(
        dunningSearch, setDunningSearch, dunningLoading, searchDunning,
        dunningError, dunningResult, actionBusy, handleDunningAction, fmtDate,
      )}
      {renderOverageTable(overages, loading, fmtCurrency, fmtDate)}
    </div>
  );
}
