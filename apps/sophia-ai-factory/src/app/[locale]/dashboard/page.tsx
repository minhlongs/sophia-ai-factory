/**
 * Dashboard home page — server component.
 * First-time: shows setup steps.
 * Returning: shows stats, quick actions, recent runs.
 */

import { redirect } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getBalance } from '@/lib/mcu/credits-repo';
import { logger } from '@/seed/utils/logger-utility';
import { TIER_CONFIG } from '@/seed/config/tiers';
import { DashboardHeroGreeting } from './components/dashboard-hero-greeting';
import { DashboardSetupSteps } from './components/dashboard-setup-steps';
import { DashboardReturningUser } from './components/dashboard-returning-user';
import { DashboardFirstCampaignCta } from './components/dashboard-first-campaign-cta';
// Round-11 F-PC-4: split heavy on-demand modal+banner+widget out of initial bundle.
// Onboarding tour is 243 LOC; only renders on first-time MASTER session.
const OnboardingTourModal = nextDynamic(() =>
  import('./components/onboarding-tour-modal').then(m => ({ default: m.OnboardingTourModal })),
);
const MasterWelcomeBanner = nextDynamic(() =>
  import('./components/master-welcome-banner').then(m => ({ default: m.MasterWelcomeBanner })),
);
import { OnboardingStatusWidget } from './components/onboarding-status-widget';
import { MissionControlWidget } from '@/forest/components/dashboard/mission-control-widget';
import { RouteHelpTooltip } from '@/components/help/route-help-tooltip';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

interface SopRunRow {
  id: string;
  status: string;
  created_at: number;
  installation_id: string;
}

interface ProfileRow {
  api_keys: string | null;
  onboarding_completed_at: number | null;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const db = createServerClient();
  const d1 = getD1();

  // Fetch profile, tier, balance in parallel
  const [profileResult, tier, balance] = await Promise.all([
    db.from('user_profiles').select('api_keys,onboarding_completed_at').eq('user_id', user.id).single(),
    getUserTier(user.id),
    getBalance(user.id).catch(() => ({ credits_remaining: 0, credits_total_purchased: 0, credits_total_used: 0 })),
  ]);

  const profile = profileResult.data as ProfileRow | null;

  // MASTER-tier FREE100 users: redirect to guided onboarding until completed
  if (tier === 'MASTER' && !profile?.onboarding_completed_at) {
    redirect('/dashboard/onboarding');
  }

  const apiKeys = (() => {
    try {
      const raw = profile?.api_keys;
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, unknown>;
    } catch { return {}; }
  })();
  const hasApiKeys = Object.keys(apiKeys).length > 0;
  // showFirstTimeSteps: only for truly new users (no onboarding completion timestamp)
  // MASTER users who redeemed FREE100 may have no BYOK keys but onboarding IS done
  const showFirstTimeSteps = !profile?.onboarding_completed_at;

  // Fetch SOP installations + trial expiry (used by MasterWelcomeBanner)
  let sopCount = 0;
  let recentRuns: SopRunRow[] = [];
  let videosThisMonth = 0;
  let trialEndsAt: number | null = null;

  if (d1) {
    try {
      const [instResult, runsResult, videosResult, trialResult] = await Promise.all([
        d1.prepare('SELECT COUNT(*) as cnt FROM user_sop_installations WHERE user_id = ?').bind(user.id).first<{ cnt: number }>(),
        d1.prepare(`SELECT r.id, r.status, r.created_at, r.installation_id
          FROM sop_runs r
          JOIN user_sop_installations i ON r.installation_id = i.id
          WHERE i.user_id = ?
          ORDER BY r.created_at DESC LIMIT 10`).bind(user.id).all<SopRunRow>(),
        d1.prepare(`SELECT COUNT(*) as cnt FROM campaigns
          WHERE user_id = ? AND created_at >= strftime('%s','now','-30 days')`)
          .bind(user.id).first<{ cnt: number }>(),
        d1.prepare(`SELECT trial_ends_at FROM subscriptions
          WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 1`)
          .bind(user.id).first<{ trial_ends_at: number | null }>(),
      ]);
      sopCount = instResult?.cnt ?? 0;
      recentRuns = runsResult.results ?? [];
      videosThisMonth = videosResult?.cnt ?? 0;
      trialEndsAt = trialResult?.trial_ends_at ?? null;
    } catch (e) {
      logger.error('[dashboard] D1 query failed', e instanceof Error ? e : new Error(String(e)));
    }
  }

  const tierLabel = TIER_CONFIG[tier]?.label ?? tier;
  const jar = await cookies();
  const isVi = jar.get('NEXT_LOCALE')?.value !== 'en';

  return (
    <div className="space-y-6">
      <OnboardingTourModal userId={user.id} tier={tierLabel} />

      {/* MASTER welcome banner — client-side, auto-dismisses via localStorage */}
      {tier === 'MASTER' && <MasterWelcomeBanner trialEndsAt={trialEndsAt} />}

      <div className="flex items-center gap-2">
        <DashboardHeroGreeting name={user.full_name} tier={tierLabel} />
        <RouteHelpTooltip locale={isVi ? 'vi' : 'en'} routeKey="dashboard" />
      </div>
      {/* Mission Control Widget — GAP3 composite hero */}
      <MissionControlWidget isVi={isVi} />
      <OnboardingStatusWidget isVi={isVi} />

      {showFirstTimeSteps && sopCount === 0 ? (
        <DashboardSetupSteps hasApiKeys={hasApiKeys} sopCount={sopCount} />
      ) : sopCount === 0 ? (
        // Onboarding done but no SOPs installed yet — show quick-action CTA
        <DashboardFirstCampaignCta />
      ) : (
        <DashboardReturningUser
          sopCount={sopCount}
          mcuRemaining={balance.credits_remaining}
          videosThisMonth={videosThisMonth}
          recentRuns={recentRuns}
        />
      )}
    </div>
  );
}
