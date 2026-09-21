'use client';

/**
 * ReferralStatsSection — reward history ledger.
 * Displays earned rewards with dates and statuses.
 * All rewards in the ledger are confirmed (written by IPN on payment).
 */

import { useTranslations } from 'next-intl';
import { Gift, Users } from 'lucide-react';
import { EmptyState } from '@/seed/components/ui/empty-state';

interface RewardRow {
  id: string;
  referred_user_id: string;
  reward_cents: number;
  created_at: string;
}

interface ReferralStatsSectionProps {
  history: RewardRow[];
  locale: string;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function fmtDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ReferralStatsSection({ history, locale }: ReferralStatsSectionProps) {
  const t = useTranslations('dashboard.referral');

  return (
    <section className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="font-semibold text-lg">{t('historyTitle')}</h2>
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('noHistoryTitle')}
          description={t('noHistoryDesc')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-1 md:px-2 font-medium text-muted-foreground text-xs md:text-sm">
                  {t('tableColumns.date')}
                </th>
                <th className="text-right py-3 px-1 md:px-2 font-medium text-muted-foreground text-xs md:text-sm">
                  {t('tableColumns.reward')}
                </th>
                <th className="text-center py-3 px-1 md:px-2 font-medium text-muted-foreground text-xs md:text-sm">
                  {t('tableColumns.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 px-2 text-foreground">
                    {fmtDate(row.created_at, locale)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono tabular-nums text-foreground">
                    ${dollars(row.reward_cents)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-500">
                      {t('statusEarned')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
