'use client';

/**
 * FinanceReportsClient — renders the P&L report from /api/admin/finance/report.
 * Response shape (per route.ts lines 123–135):
 *   { period, from, to,
 *     pnl: { revenue, cogs, gross_profit, gross_margin_pct, opex, net, net_margin_pct },
 *     mrr_waterfall: unknown[],
 *     metrics: { active_customers, arpu, ltv, cac, churn_rate, ltv_cac, tx_count },
 *     notes: string[] }
 */

import { useMemo, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string): Promise<ReportResponse> => fetch(url).then((r) => r.json());

type PnL = {
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  opex: number;
  net: number;
  net_margin_pct: number;
};

type Metrics = {
  active_customers: number;
  arpu: number;
  ltv: number;
  cac: number;
  churn_rate: number;
  ltv_cac: number;
  tx_count: number;
};

type ReportResponse = {
  period: string;
  from: string;
  to: string;
  pnl: PnL;
  mrr_waterfall: unknown[];
  metrics: Metrics;
  notes: string[];
};

const PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'ytd', label: 'YTD' },
] as const;

function fmt(n: number) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '-';
  return `${n.toFixed(1)}%`;
}

function Row({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? 'font-semibold bg-muted/40' : ''}>
      <td className="px-4 py-2">
        <div>{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </td>
      <td className="px-4 py-2 text-right">{value}</td>
    </tr>
  );
}

export default function FinanceReportsClient({}: { locale?: string }) {
  const [period, setPeriod] = useState<string>('monthly');

  const query = useMemo(() => {
    const u = new URL('/api/admin/finance/report', window.location.origin);
    u.searchParams.set('period', period);
    u.searchParams.set('from', '2026-01-01');
    u.searchParams.set('to', '2026-12-31');
    return u.toString();
  }, [period]);

  const { data, isLoading, error } = useSWR<ReportResponse>(query, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financial Reports</h1>
          <p className="text-sm text-muted-foreground">
            Auto-generated from billing ledger. Updates every 5 minutes.
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading report…</p>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load report. Ensure you are logged in as admin.
        </div>
      )}

      {data && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* P&L */}
          <div className="rounded-lg border">
            <div className="border-b px-4 py-3 font-semibold">
              P&L — {data.from} → {data.to}
            </div>
            <table className="w-full text-sm">
              <tbody>
                <Row label="Revenue" value={fmt(data.pnl.revenue)} />
                <Row
                  label="COGS"
                  value={`-${fmt(data.pnl.cogs)}`}
                  sub={pct(
                    (data.pnl.cogs / data.pnl.revenue) * 100,
                  )}
                />
                <Row
                  label="Gross Profit"
                  value={fmt(data.pnl.gross_profit)}
                  sub={`Margin ${pct(data.pnl.gross_margin_pct)}`}
                  highlight
                />
                <Row
                  label="OpEx"
                  value={`-${fmt(data.pnl.opex)}`}
                  sub="incl. headcount, infra, GTM"
                />
                <Row
                  label="Net"
                  value={fmt(data.pnl.net)}
                  sub={`Margin ${pct(data.pnl.net_margin_pct)}`}
                  highlight
                />
              </tbody>
            </table>
          </div>

          {/* Metrics */}
          <div className="rounded-lg border">
            <div className="border-b px-4 py-3 font-semibold">
              Key Metrics
            </div>
            <table className="w-full text-sm">
              <tbody>
                <Row label="Active Customers" value={String(data.metrics.active_customers)} />
                <Row label="ARPU" value={fmt(data.metrics.arpu)} />
                <Row label="LTV" value={fmt(data.metrics.ltv)} />
                <Row label="CAC" value={fmt(data.metrics.cac)} />
                <Row label="Churn Rate" value={pct(data.metrics.churn_rate)} />
                <Row label="LTV / CAC" value={String(data.metrics.ltv_cac)} highlight />
                <Row label="Transactions" value={String(data.metrics.tx_count)} />
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {data.notes.length > 0 && (
            <div className="md:col-span-2 rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
              <div className="font-semibold mb-1">Notes</div>
              <ul className="list-disc pl-5 space-y-1">
                {data.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
