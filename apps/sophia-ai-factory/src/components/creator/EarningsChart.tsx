/**
 * EarningsChart — horizontal stacked bar showing creator earnings breakdown.
 *
 * Shows 4 segments: Paid, Available (payable), Pending (14-day hold), Platform (30% cut).
 * Color-coded: green=paid, blue=payable, yellow=pending, gray=platform.
 * Mobile-responsive with dollar amounts on each segment.
 *
 * @module components/creator/EarningsChart
 */

'use client';

import { useTranslations } from 'next-intl';

interface EarningsChartProps {
  earnings: number;
  pendingCents: number;
  payableCents: number;
  paidCents: number;
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function EarningsChart({
  earnings,
  pendingCents,
  payableCents,
  paidCents,
}: EarningsChartProps) {
  const t = useTranslations('marketplace.creator');

  // Platform fee = (creatorEarnings / 0.7) * 0.3 = creatorEarnings * 3/7
  const platformCents = earnings > 0 ? Math.round((earnings * 3) / 7) : 0;
  const grossCents = earnings + platformCents;

  const segments: Array<{
    key: string;
    label: string;
    amount: number;
    color: string;
  }> = [
    { key: 'paid', label: t('paid'), amount: paidCents, color: 'bg-green-500' },
    { key: 'available', label: t('available'), amount: payableCents, color: 'bg-primary/10' },
    { key: 'pending', label: t('pending'), amount: pendingCents, color: 'bg-yellow-500' },
    { key: 'platform', label: t('platform'), amount: platformCents, color: 'bg-gray-400' },
  ];

  return (
    <div className="space-y-3">
      {/* Total */}
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{t('earnings')}</span>
        <span className="text-2xl font-bold">{formatUsd(earnings)}</span>
      </div>

      {/* Stacked bar */}
      {grossCents > 0 ? (
        <div className="flex h-8 w-full overflow-hidden rounded-md">
          {segments.map((seg) => {
            const widthPct = (seg.amount / grossCents) * 100;
            if (widthPct < 0.5) return null;
            return (
              <div
                key={seg.key}
                className={`${seg.color} flex items-center justify-center text-[10px] font-medium text-white first:rounded-l-md last:rounded-r-md`}
                style={{ width: `${widthPct}%`, minWidth: 0 }}
                title={`${seg.label}: ${formatUsd(seg.amount)}`}
              >
                <span className="truncate px-1">
                  {formatUsd(seg.amount)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-8 w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
          $0.00
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm ${seg.color}`}
            />
            <span>{seg.label}</span>
            <span className="font-medium text-foreground">
              {formatUsd(seg.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
