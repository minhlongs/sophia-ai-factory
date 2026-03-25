'use client';

/**
 * Usage Analytics Page
 * Shows MCU consumption for the billing period, progress bar,
 * command-type breakdown, and a daily usage CSS bar chart.
 */

import { useEffect, useState } from 'react';

interface DayEntry {
  date: string;
  count: number;
  mcu: number;
}

interface UsageStats {
  total_calls: number;
  total_mcu: number;
  avg_response_ms: number;
  calls_by_day: DayEntry[];
}

interface BillingData {
  balance: { balance: number; lifetimeUsed: number } | null;
  subscription: { mcuMonthly: number } | null;
}

interface CommandBreakdown {
  feature: string;
  mcu: number;
  calls: number;
}

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [breakdown, setBreakdown] = useState<CommandBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/raas/usage?days=30').then(r => r.json()),
      fetch('/api/billing/subscription').then(r => r.json()),
    ])
      .then(([usageData, billingData]) => {
        const s: UsageStats = usageData.stats ?? { total_calls: 0, total_mcu: 0, avg_response_ms: 0, calls_by_day: [] };
        setStats(s);
        setBilling({ balance: billingData.balance ?? null, subscription: billingData.subscription ?? null });

        // Derive command breakdown from calls_by_day if available,
        // otherwise build a placeholder from total stats only.
        const dayEntries: DayEntry[] = s.calls_by_day ?? [];
        const featureMap: Record<string, CommandBreakdown> = {};
        dayEntries.forEach(d => {
          const key = d.date; // fallback label when feature key unavailable
          if (!featureMap[key]) featureMap[key] = { feature: key, mcu: 0, calls: 0 };
          featureMap[key].mcu += d.mcu;
          featureMap[key].calls += d.count;
        });
        setBreakdown(Object.values(featureMap).sort((a, b) => b.mcu - a.mcu).slice(0, 7));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const used = billing?.balance?.lifetimeUsed ?? 0;
  const limit = billing?.subscription?.mcuMonthly ?? 500;
  const balance = billing?.balance?.balance ?? 0;
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const isHigh = pct > 80;

  // Last 14 days bar chart data
  const last14: DayEntry[] = (() => {
    if (!stats) return [];
    const days = stats.calls_by_day.slice(-14);
    const maxMcu = Math.max(...days.map(d => d.mcu), 1);
    return days.map(d => ({ ...d, mcu: d.mcu, _pct: Math.round((d.mcu / maxMcu) * 100) } as DayEntry & { _pct: number }));
  })() as (DayEntry & { _pct?: number })[];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usage Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">MCU consumption for current billing period</p>
      </div>

      {/* MCU consumption card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">MCU Used This Period</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {loading ? '—' : used.toLocaleString()}
              <span className="text-base font-normal text-gray-400 ml-1">/ {limit.toLocaleString()} MCU</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Remaining</p>
            <p className={`text-2xl font-bold mt-1 ${balance < 50 ? 'text-red-600' : 'text-green-600'}`}>
              {loading ? '—' : balance.toLocaleString()}
              <span className="text-sm font-normal text-gray-400 ml-1">MCU</span>
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{pct}% used</span>
            {isHigh && <span className="text-red-500 font-medium">High usage</span>}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${isHigh ? 'bg-red-500' : 'bg-orange-500'}`}
              style={{ width: `${loading ? 0 : pct}%` }}
            />
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
          {[
            { label: 'Total API Calls', value: stats?.total_calls ?? 0, icon: 'api' },
            { label: 'Total MCU Consumed', value: stats?.total_mcu ?? 0, icon: 'toll' },
            { label: 'Avg Response (ms)', value: stats?.avg_response_ms ?? 0, icon: 'speed' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-sm text-gray-400">{icon}</span>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {loading ? '—' : value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily usage chart */}
      {!loading && last14.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Daily MCU Usage (last 14 days)</h2>
          <div className="flex items-end gap-1 h-24">
            {last14.map((d) => {
              const barPct = (d as DayEntry & { _pct?: number })._pct ?? 0;
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full bg-orange-400 rounded-t hover:bg-orange-500 transition-colors cursor-default"
                    style={{ height: `${Math.max(barPct, 2)}%` }}
                    title={`${d.date}: ${d.mcu} MCU`}
                  />
                  <span className="text-xs text-gray-300 group-hover:text-gray-500 transition-colors">
                    {d.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Command breakdown */}
      {!loading && breakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Breakdown by Date</h2>
          <div className="space-y-2">
            {breakdown.map(({ feature, mcu, calls }) => {
              const rowPct = Math.round((mcu / Math.max(stats?.total_mcu ?? 1, 1)) * 100);
              return (
                <div key={feature} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 shrink-0 font-mono truncate">{feature}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-orange-400 h-2 rounded-full"
                      style={{ width: `${rowPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-700 font-medium w-20 text-right shrink-0">
                    {mcu.toLocaleString()} MCU
                  </span>
                  <span className="text-xs text-gray-400 w-16 text-right shrink-0">
                    {calls} calls
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && breakdown.length === 0 && (stats?.total_calls ?? 0) === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300 block mb-2">bar_chart</span>
          <p className="text-gray-500 text-sm">No usage recorded yet. Launch your first mission to see data here.</p>
        </div>
      )}
    </div>
  );
}
