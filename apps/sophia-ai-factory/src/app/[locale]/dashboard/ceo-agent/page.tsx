/**
 * CEO Agent — root page for the AI Executive Board (PREMIUM+ gate).
 *
 * Phases 1-5 (Tier gate, Daily Briefing, Campaign Management, Revenue Insights,
 * Onboarding) are rendered as children of this segment. This page is the single
 * source of truth for the tier gate so sub-pages don't re-implement it.
 *
 * Server Component — fetch tier via `loadCeoAgentPage`, then delegate
 * presentation to the client-side `CeoAgentShell` and (PREMIUM+) the onboarding
 * wrapper.
 */

import { loadCeoAgentPage } from '@/land/ceo-agent/load-ceo-agent-page';
import { CeoAgentShell } from './ceo-agent-shell';
import { TierGateCardLoader } from './tier-gate-card-loader';
import { CeoAgentDashboardOnboardingWrapper } from '@/forest/components/agents/ceo-agent-dashboard-onboarding-wrapper';

export const dynamic = 'force-dynamic';

export interface CeoAgentPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CeoAgentPage({ params }: CeoAgentPageProps) {
  const initial = await loadCeoAgentPage({ params });
  const hasAccess = initial.userTier !== 'BASIC';

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">CEO Agent</h1>
          <p className="text-sm text-muted-foreground">
            Your CEO Agent — daily briefing, campaigns, and revenue insights.
          </p>
        </header>
        <TierGateCardLoader currentTier={initial.userTier} />
      </div>
    );
  }

  return (
    <>
      <CeoAgentShell locale={initial.locale} hasAccess={hasAccess} currentTier={initial.userTier} userId={initial.user.id} />
      <CeoAgentDashboardOnboardingWrapper />
    </>
  );
}
