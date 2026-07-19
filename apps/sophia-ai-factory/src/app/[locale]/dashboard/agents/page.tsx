/**
 * Dashboard Agents page — wraps AgentTeamPanel as a full-page view.
 * Existing AgentTeamPanel polls /api/agents/list and renders agent cards.
 *
 * Tier gated: BASIC users see an upgrade upsell. PREMIUM+ users see the full agent team.
 * CEO Agent Daily Briefing: PREMIUM+ users see a morning briefing card on page load.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import nextDynamic from 'next/dynamic';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { TierGateCard } from '@/seed/components/ui/tier-gate-card';
import { generateDailyBriefing } from '@/forest/agents/daily-briefing/briefing-generator';
import { AgentTeamPanel } from '@/forest/components/missions/agent-team-panel';
import { DailyBriefingCard } from '@/forest/components/agents/daily-briefing-card';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { Tier } from '@/seed/types';

export const dynamic = 'force-dynamic';

// Lazy-load the onboarding wrapper (client component, only rendered for PREMIUM+)
const CeoAgentOnboardingWrapper = nextDynamic(() =>
  import('@/forest/components/agents/ceo-agent-onboarding-wrapper').then((m) => ({
    default: m.CeoAgentOnboardingWrapper,
  })),
);

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getTranslations('dashboard.missions.control');

  let userTier: Tier = 'BASIC';
  let briefing = null;
  try {
    userTier = await resolveUserTier(user.id);
  } catch (err) {
    logger.error('[AgentsPage] Failed to load tier', toError(err));
  }

  const hasPremiumAccess = userTier !== 'BASIC';

  // Generate daily briefing for PREMIUM+ users (graceful if it fails)
  if (hasPremiumAccess) {
    try {
      briefing = await generateDailyBriefing(user.id, locale);
    } catch (err) {
      logger.warn('[AgentsPage] Daily briefing generation failed', toError(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('agent_team')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('task_feed')}</p>
      </div>

      {hasPremiumAccess ? (
        <>
          {/* CEO Agent onboarding tour (welcome card + tour overlay) */}
          <CeoAgentOnboardingWrapper />

          {/* CEO Agent Daily Briefing card */}
          <DailyBriefingCard briefing={briefing} />

          {/* Agent team panel */}
          <AgentTeamPanel />
        </>
      ) : (
        <TierGateCard
          requiredTier="PREMIUM"
          currentTier={userTier}
          featureName={t('agent_team')}
        >
          {null}
        </TierGateCard>
      )}
    </div>
  );
}
