import React from 'react';
import dynamic from 'next/dynamic';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { logger } from '@/seed/utils/logger-utility';

// ── Dynamic import (client component with charts) ─────────────────────────────

const AgentSessionsClient = dynamic(
  () =>
    import('./components/agent-sessions-client').then((m) => ({
      default: m.AgentSessionsClient,
    })),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
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
  title: 'Agent Sessions | Sophia AI',
  description: 'Monitor multi-agent execution sessions and task assignments',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AgentSessionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    logger.warn('[AgentSessions] Unauthenticated access attempt');
    redirect('/login');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agent Sessions</h1>
        <p className="text-muted-foreground">
          Monitor active and completed multi-agent execution sessions and task assignments.
        </p>
      </div>

      <AgentSessionsClient userId={user.id} />
    </div>
  );
}
