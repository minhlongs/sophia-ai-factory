'use client';

/**
 * MCU Balance Widget
 * Shows current MCU balance, monthly usage bar, low balance warning, and buy-more link.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface BalanceData {
  balance: number;
  monthlyUsed: number;
  monthlyLimit: number;
}

export function McuBalanceWidget() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then(r => r.json())
      .then(d => {
        setData({
          balance: d.balance?.balance ?? 0,
          monthlyUsed: d.balance?.lifetimeUsed ?? 0,
          monthlyLimit: d.subscription?.mcuMonthly ?? 500,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-20 bg-gray-100 animate-pulse rounded-xl" />;

  const balance = data?.balance ?? 0;
  const used = data?.monthlyUsed ?? 0;
  const limit = data?.monthlyLimit ?? 500;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const low = balance < 50;

  return (
    <div className={`rounded-xl border p-4 ${low ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">MCU Balance</span>
        <Link href="/billing/upgrade" className="text-xs text-orange-600 hover:underline font-medium">
          Buy more
        </Link>
      </div>

      <p className={`text-2xl font-bold ${low ? 'text-red-600' : 'text-gray-900'}`}>
        {balance.toLocaleString()}
        <span className="text-sm font-normal text-gray-500 ml-1">MCU</span>
      </p>

      {low && (
        <p className="text-xs text-red-600 mt-1">Low balance — upgrade to continue</p>
      )}

      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Used this month</span>
          <span>{used.toLocaleString()} / {limit.toLocaleString()}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${pct > 80 ? 'bg-red-500' : 'bg-orange-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
