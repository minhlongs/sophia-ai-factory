'use client';

import { AlertCircle } from 'lucide-react';
import type { Tier } from '@/seed/types';

interface LoseItemProps {
  text: string;
}

export function LoseItem({ text }: LoseItemProps) {
  return (
    <div className="flex items-center gap-2">
      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
      <span className="text-xs text-amber-700 dark:text-amber-300">{text}</span>
    </div>
  );
}

export function getTierLossKeys(tier: Tier): string[] {
  const TIER_LOSS_KEYS: Record<Tier, string[]> = {
    BASIC: ['lose_basic_affiliate', 'lose_basic_videos', 'lose_basic_analytics'],
    PREMIUM: ['lose_premium_api', 'lose_premium_affiliate', 'lose_premium_channels', 'lose_premium_priority'],
    ENTERPRISE: ['lose_enterprise_unlimited', 'lose_enterprise_integrations', 'lose_enterprise_seo', 'lose_enterprise_strategy'],
    MASTER: ['lose_master_lifetime', 'lose_master_vip', 'lose_master_all'],
  };
  return TIER_LOSS_KEYS[tier] ?? TIER_LOSS_KEYS.BASIC;
}
