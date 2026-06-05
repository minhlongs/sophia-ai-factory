/**
 * /dashboard/onboarding — canonical onboarding page (BYOK setup wizard).
 *
 * Replaces /setup-wizard as the single onboarding URL per plan
 * 260519-0300-handover-funnel-critical-fixes/phase-02-setup-wizard-locale-routing.md.
 *
 * Auth gate: any authenticated user lands here (any tier).
 * MASTER users who have completed all 3 post-activation milestones are
 * auto-completed and redirected to /dashboard (protected flow preserved).
 * All other authenticated users see the BYOK setup wizard.
 *
 * @module app/[locale]/dashboard/onboarding/page
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { WizardClient } from './wizard-client';
import { completeOnboardingAction } from '@/app/actions/complete-onboarding-action';

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

interface StepStatusRow { cnt: number }

async function loadMasterStepStatus(db: D1Database, userId: string) {
  const [missions, channels, telegram, jobs] = await Promise.allSettled([
    db
      .prepare(`SELECT COUNT(*) as cnt FROM engine_missions WHERE user_id = ?1 AND status = 'succeeded'`)
      .bind(userId)
      .first<StepStatusRow>(),
    db
      .prepare(`SELECT COUNT(*) as cnt FROM publishing_channels WHERE user_id = ?1 AND status = 'active'`)
      .bind(userId)
      .first<StepStatusRow>(),
    db
      .prepare(`SELECT COUNT(*) as cnt FROM telegram_paired_chats WHERE paired_by = ?1`)
      .bind(userId)
      .first<StepStatusRow>(),
    db
      .prepare(`SELECT COUNT(*) as cnt FROM publishing_jobs WHERE status = 'live'
               AND channel_id IN (SELECT id FROM publishing_channels WHERE user_id = ?1)`)
      .bind(userId)
      .first<StepStatusRow>(),
  ]);

  const step1Done = (missions.status === 'fulfilled' ? (missions.value?.cnt ?? 0) : 0) > 0;
  const channelsCnt = channels.status === 'fulfilled' ? (channels.value?.cnt ?? 0) : 0;
  const telegramCnt = telegram.status === 'fulfilled' ? (telegram.value?.cnt ?? 0) : 0;
  const step2Done = channelsCnt > 0 || telegramCnt > 0;
  const step3Done = (jobs.status === 'fulfilled' ? (jobs.value?.cnt ?? 0) : 0) > 0;

  return { step1Done, step2Done, step3Done };
}

export default async function OnboardingPage(
  _props?: { params?: Promise<{ locale: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
    return null;
  }

  // MASTER users who have completed all post-activation milestones are
  // auto-completed and sent to dashboard. This preserves the protected flow
  // (sophia-handover-rules.md: MASTER post-onboarding must not be re-prompted).
  const tier = await resolveUserTier(user.id);
  if (tier === 'MASTER') {
    const d1 = getD1();
    if (d1) {
      try {
        const { step1Done, step2Done, step3Done } = await loadMasterStepStatus(d1, user.id);
        if (step1Done && step2Done && step3Done) {
          try {
            await completeOnboardingAction({ reason: 'complete' });
          } catch {
            // non-fatal — redirect proceeds
          }
          redirect('/dashboard');
          return null;
        }
      } catch (e) {
        logger.error('[OnboardingPage] loadMasterStepStatus failed', e instanceof Error ? e : new Error(String(e)));
        // non-fatal — fall through to wizard
      }
    }
  }

  // All authenticated users (any tier, or MASTER with incomplete milestones)
  // see the BYOK setup wizard.
  return <WizardClient />;
}
