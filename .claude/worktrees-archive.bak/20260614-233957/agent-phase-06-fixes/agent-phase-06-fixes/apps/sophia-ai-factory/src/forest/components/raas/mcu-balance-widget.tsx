'use client';

/**
 * MCU Balance Widget
 *
 * Shows MCU credit balance, monthly usage bar, low balance warning.
 * Uses config/tiers for tier limits.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface BalanceData {
  balance: number;
  monthlyUsed: number;
  monthlyLimit: number;
}

interface RaasUsageResponse {
  balance?: number;
  monthly_used?: number;
  monthly_limit?: number;
}

export function McuBalanceWidget() {
  const t = useTranslations('dashboard.missions');
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const r = await fetch('/api/raas/usage');
        const d = (await r.json()) as RaasUsageResponse;
        setData({
          balance: d.balance ?? 0,
          monthlyUsed: d.monthly_used ?? 0,
          monthlyLimit: d.monthly_limit ?? 1000,
        });
      } catch {
        // silently fail, use defaults
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, []);

  if (loading) return <div className="h-24 bg-muted motion-safe:animate-pulse rounded-xl" />;

  const balance = data?.balance ?? 0;
  const used = data?.monthlyUsed ?? 0;
  const limit = data?.monthlyLimit ?? 1000;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const low = balance < 50;

  return (
    <div className={`rounded-xl border p-4 ${low ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{t('mcu_balance')}</span>
        <Link href="/dashboard/billing" className="text-xs text-primary hover:underline font-medium">
          {t('upgrade')}
        </Link>
      </div>

      <p className={`text-2xl font-bold tabular-nums ${low ? 'text-destructive' : 'text-foreground'}`}>
        {balance.toLocaleString()}
        <span className="text-sm font-normal text-muted-foreground ml-1">MCU</span>
      </p>

      {low && (
        <p className="text-xs text-destructive mt-1">{t('low_balance')}</p>
      )}

      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{t('used_this_month')}</span>
          <span className="tabular-nums">{used.toLocaleString()} / {limit.toLocaleString()}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${pct > 80 ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
