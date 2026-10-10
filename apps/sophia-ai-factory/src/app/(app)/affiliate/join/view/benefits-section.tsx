'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Percent, Package } from 'lucide-react';
import type { ValidateAffiliateInviteResult } from './types';

interface BenefitsSectionProps {
  invite: NonNullable<ValidateAffiliateInviteResult['invite']>;
}

export function BenefitsSection({ invite }: BenefitsSectionProps) {
  const t = useTranslations('stitch.affiliates.join');

  return (
    <div className="p-4 rounded-xl bg-black/20 dark:bg-white/[0.02] border border-border dark:border-white/[0.08] space-y-3">
      <div className="flex items-center gap-3 text-emerald-400">
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Percent className="w-4 h-4" />
        </div>
        <div>
          <span className="text-sm font-semibold">
            {t('exclusiveRate', { rate: invite.customCommissionRatePct })}
          </span>
        </div>
      </div>

      {invite.welcomeMessage && (
        <div className="p-3 rounded-lg bg-black/30 border border-white/[0.04] text-xs text-muted-foreground italic">
          {t('inviterNote', { message: invite.welcomeMessage })}
        </div>
      )}

      {invite.assetKits && invite.assetKits.length > 0 && (
        <div className="pt-2 border-t border-white/[0.06] space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-primary" />
            {t('assetKitsIncluded')}
          </span>
          <div className="flex flex-wrap gap-2">
            {invite.assetKits.map((kit) => (
              <span
                key={kit}
                className="px-2.5 py-1 rounded-md text-xs bg-primary/10 border border-primary/20 text-primary font-medium"
              >
                {kit}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
