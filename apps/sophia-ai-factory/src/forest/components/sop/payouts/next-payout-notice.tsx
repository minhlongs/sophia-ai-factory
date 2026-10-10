'use client';

import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { getNextPayoutDate } from './payout-helpers';

export function NextPayoutNotice() {
  const t = useTranslations('sop.creator');

  return (
    <div className="flex items-center gap-3 rounded-xl bg-primary-500/10 border border-primary-500/20 p-4">
      <Clock className="w-5 h-5 text-primary-400 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-white">{t('payouts.nextPayout')}</p>
        <p className="text-xs text-white/50 mt-0.5">{getNextPayoutDate()}</p>
      </div>
    </div>
  );
}
