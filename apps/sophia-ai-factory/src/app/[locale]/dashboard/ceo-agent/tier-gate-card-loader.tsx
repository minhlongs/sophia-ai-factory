/**
 * TierGateCardLoader — lazy-loads TierGateCard to keep the main dashboard
 * bundle small for BASIC users who never see the CEO Agent features.
 */

'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/seed/components/ui/skeleton';

const TierGateCard = dynamic(
  () => import('@/seed/components/ui/tier-gate-card').then((m) => ({ default: m.TierGateCard })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="mx-auto h-24 w-24 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-6 w-48" />
        <Skeleton className="mx-auto mt-2 h-4 w-72" />
        <Skeleton className="mx-auto mt-5 h-10 w-40" />
      </div>
    ),
  },
);

export function TierGateCardLoader({ currentTier }: { currentTier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER' }) {
  return (
    <TierGateCard requiredTier="PREMIUM" currentTier={currentTier ?? 'BASIC'} featureName="CEO Agent">
      <div className="py-12 text-center text-sm text-muted-foreground">CEO Agent Feature</div>
    </TierGateCard>
  );
}
