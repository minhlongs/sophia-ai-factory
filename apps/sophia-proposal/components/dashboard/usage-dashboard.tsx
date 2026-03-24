'use client';

/**
 * Usage Dashboard Client Component
 * MCU balance, breakdown by command type, date range filter.
 */

import { useEffect, useState } from 'react';

interface UsageLog {
  id: string;
  feature: string;
  mcu_cost: number;
  created_at: string;
}

interface BalanceData {
  balance: number;
  total_purchased: number;
}

type DateRange = '7d' | '30d' | '90d';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function groupByFeature(logs: UsageLog[]): { feature: string; count: number; mcu: number }[] {
  const map = new Map<string, { count: number; mcu: number }>();
  for (const log of logs) {
    const key = log.feature.replace(/:/g, ' > ');
    const existing = map.get(key) ?? { count: 0, mcu: 0 };
    map.set(key, { count: existing.count + 1, mcu: existing.mcu + log.mcu_cost });
  }
  return Array.from(map.entries())
    .map(([feature, stats]) => ({ feature, ...stats }))
    .sort((a, b) => b.mcu - a.mcu);
}

export function UsageDashboard() {
  const [range, setRange] = useState<DateRange>('30d');
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    Promise.all([
      fetch(`/api/usage?limit=500&days=${days}`).then(r => r.json()),
      fetch('/api/billing/subscription').then(r => r.json()),
    ])
      .then(([usageData, billingData]) => {
        setLogs(usageData.logs ?? []);
        setBalance(billingData.balance ?? null);
      })
      .catch(() => setError('Failed to load usage data'))
      .finally(() => setLoading(false));
  }, [range]);

  const totalMcu = logs.reduce((sum, l) => sum + l.mcu_cost, 0);
  const breakdown = groupByFeature(logs);

  return (
    <div className="space-y-6">
      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">MCU Balance</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">
            {balance?.balance?.toLocaleString() ?? '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Purchased</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {balance?.total_purchased?.toLocaleString() ?? '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">MCU Used ({range})</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {loading ? '…' : totalMcu.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Period:</span>
        {DATE_RANGE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              range === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Breakdown table */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading…</div>
      ) : error ? null : breakdown.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No usage in this period.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Command type</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">Calls</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">MCU used</th>
                <th className="px-5 py-3 text-right font-medium text-gray-500">% of total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {breakdown.map(row => (
                <tr key={row.feature} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{row.feature}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{row.count.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-gray-900 font-medium">{row.mcu.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-gray-500">
                    {totalMcu > 0 ? `${((row.mcu / totalMcu) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
