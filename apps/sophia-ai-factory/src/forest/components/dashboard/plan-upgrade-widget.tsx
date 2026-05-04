'use client';

/**
 * PlanUpgradeWidget — shows current tier and upgrade options.
 * Uses tracked POST /api/checkout instead of raw NOWPayments URLs.
 * Displays period_end (renews date) and optional history link.
 */

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import { Crown, ArrowUp, Loader2 } from 'lucide-react';

interface Props {
  currentTier: Tier;
  periodEnd?: string | null;
  showHistoryLink?: boolean;
}

interface CheckoutResponse {
  url?: string;
  orderId?: string;
  error?: string;
  redirectTo?: string;
}

const TIER_ORDER: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

export function PlanUpgradeWidget({ currentTier, periodEnd, showHistoryLink }: Props) {
  const locale = useLocale();
  const [loading, setLoading] = useState<Tier | null>(null);
  const current = UNIFIED_TIERS[currentTier];
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  const upgradeTiers = TIER_ORDER.filter((_, i) => i > currentIdx);

  const handleUpgrade = async (tier: Tier) => {
    setLoading(tier);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json() as CheckoutResponse;

      if (res.status === 401 && data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Checkout failed. Please try again.');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  // Format period end date
  const periodEndDisplay = periodEnd
    ? (UNIFIED_TIERS[currentTier]?.billingType === 'lifetime'
        ? 'Lifetime — never expires'
        : `Renews ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(periodEnd))}`)
    : null;

  if (upgradeTiers.length === 0) {
    return (
      <div className="bg-gradient-to-r from-amber-500/10 to-violet-500/10 border border-amber-500/30 rounded-xl p-5">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-foreground">Gói {current.name} — Cao Nhất</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Bạn đang sử dụng gói cao nhất. Cảm ơn bạn!
        </p>
        {periodEndDisplay && (
          <p className="text-xs text-muted-foreground mt-2">{periodEndDisplay}</p>
        )}
      </div>
    );
  }

  const billingLabel = current.billingType === 'lifetime' ? 'trọn đời' : 'tháng';

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-violet-400" />
          <span className="font-semibold text-foreground">Gói Hiện Tại: {current.name}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          ${current.price}/{billingLabel} — {current.mcuMonthly.toLocaleString()} MCU/tháng
        </p>
        {periodEndDisplay && (
          <p className="text-xs text-muted-foreground mt-1">{periodEndDisplay}</p>
        )}
      </div>

      <div className="grid gap-2">
        {upgradeTiers.map(tier => {
          const t = UNIFIED_TIERS[tier];
          const tierBillingLabel = t.billingType === 'lifetime' ? 'trọn đời' : 'tháng';
          const isLoading = loading === tier;
          return (
            <button
              key={tier}
              onClick={() => handleUpgrade(tier)}
              disabled={isLoading || loading !== null}
              className="flex items-center justify-between px-4 py-3 bg-muted/50 border border-border/50 rounded-lg hover:border-violet-500/40 hover:bg-violet-500/5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-left w-full"
            >
              <div>
                <span className="font-medium text-foreground">{t.name}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ${t.price}/{tierBillingLabel}
                </span>
              </div>
              {isLoading
                ? <Loader2 className="w-4 h-4 text-violet-400 motion-safe:animate-spin" />
                : <ArrowUp className="w-4 h-4 text-violet-400" />
              }
            </button>
          );
        })}
      </div>

      {showHistoryLink && (
        <p className="text-xs text-muted-foreground">
          <a
            href="/dashboard/orders"
            className="text-violet-400 hover:text-violet-300 underline"
          >
            View past orders
          </a>
        </p>
      )}
    </div>
  );
}
