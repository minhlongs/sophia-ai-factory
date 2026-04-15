'use client';

/**
 * PlanUpgradeWidget — shows current tier and upgrade options with NOWPayments checkout links.
 * Placed on the settings page next to the referral widget.
 */

import { UNIFIED_TIERS } from '@/config/tiers';
import { NOWPAYMENTS_TIERS } from '@/lib/clients/nowpayments-client';
import type { Tier } from '@/types';
import { Crown, ArrowUp } from 'lucide-react';

interface Props {
  currentTier: Tier;
}

const TIER_ORDER: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

/** Build checkout URL from NOWPayments invoice ID (no order tracking — used for display links) */
function getCheckoutUrl(tier: Tier): string {
  const iid = NOWPAYMENTS_TIERS[tier]?.invoiceId;
  if (!iid) return '/pricing';
  return `https://nowpayments.io/payment/?iid=${iid}`;
}

export function PlanUpgradeWidget({ currentTier }: Props) {
  const current = UNIFIED_TIERS[currentTier];
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  const upgradeTiers = TIER_ORDER.filter((_, i) => i > currentIdx);

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
      </div>

      <div className="grid gap-2">
        {upgradeTiers.map(tier => {
          const t = UNIFIED_TIERS[tier];
          const tierBillingLabel = t.billingType === 'lifetime' ? 'trọn đời' : 'tháng';
          return (
            <a
              key={tier}
              href={getCheckoutUrl(tier)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 bg-muted/50 border border-border/50 rounded-lg hover:border-violet-500/40 hover:bg-violet-500/5 transition-colors"
            >
              <div>
                <span className="font-medium text-foreground">{t.name}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ${t.price}/{tierBillingLabel}
                </span>
              </div>
              <ArrowUp className="w-4 h-4 text-violet-400" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
