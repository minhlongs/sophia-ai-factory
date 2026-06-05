import React from 'react';
import dynamic from 'next/dynamic';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { redirect } from 'next/navigation';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { TierGateCard } from '@/seed/components/ui/tier-gate-card';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { Tier } from '@/seed/types';

// ── Dynamic import (client component with charts) ─────────────────────────────

const ConfidenceMonitorClient = dynamic(
  () =>
    import('./components/confidence-monitor-client').then((m) => ({
      default: m.ConfidenceMonitorClient,
    })),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    ),
  }
);

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'AGI Confidence Monitor | Sophia AI',
  description: 'Monitor AGI execution confidence scores and human escalation requests',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ConfidenceMonitorPage() {
  const user = await getCurrentUser();

  if (!user) {
    logger.warn('[ConfidenceMonitor] Unauthenticated access attempt');
    redirect('/login');
  }

  let userTier: Tier = 'BASIC';
  try {
    userTier = await resolveUserTier(user.id);
  } catch (err) {
    logger.error('[ConfidenceMonitor] Failed to load tier', toError(err));
  }

  const hasPremiumAccess = userTier !== 'BASIC';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AGI Confidence Monitor</h1>
        <p className="text-muted-foreground">
          Track execution confidence scores and human escalation requests across SOP runs.
        </p>
      </div>

      {hasPremiumAccess ? (
        <ConfidenceMonitorClient userId={user.id} />
      ) : (
        <TierGateCard
          requiredTier="PREMIUM"
          currentTier={userTier}
          featureName="AGI Confidence Monitor"
        >
          {null}
        </TierGateCard>
      )}
    </div>
  );
}
