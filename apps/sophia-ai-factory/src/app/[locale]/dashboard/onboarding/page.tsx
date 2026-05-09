/**
 * /dashboard/onboarding — server component.
 *
 * Shown to MASTER-tier (FREE100) users who haven't completed onboarding.
 * Loads step completion status from D1 and renders <OnboardingSteps />.
 * Auto-completes onboarding when all 3 steps are done.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { OnboardingSteps } from './components/onboarding-steps';
import { SkipButton } from './components/skip-button';
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

async function loadStepStatus(db: D1Database, userId: string) {
  const [missions, channels, jobs] = await Promise.allSettled([
    db
      .prepare(`SELECT COUNT(*) as cnt FROM engine_missions WHERE user_id = ?1 AND status = 'succeeded'`)
      .bind(userId)
      .first<StepStatusRow>(),
    db
      .prepare(
        `SELECT COUNT(*) as cnt FROM publishing_channels WHERE user_id = ?1 AND status = 'active'
         UNION ALL
         SELECT COUNT(*) as cnt FROM telegram_paired_chats WHERE paired_by = ?1 LIMIT 1`,
      )
      .bind(userId)
      .first<StepStatusRow>(),
    db
      .prepare(`SELECT COUNT(*) as cnt FROM publishing_jobs WHERE status = 'live'
               AND channel_id IN (SELECT id FROM publishing_channels WHERE user_id = ?1)`)
      .bind(userId)
      .first<StepStatusRow>(),
  ]);

  const step1Done = (missions.status === 'fulfilled' ? (missions.value?.cnt ?? 0) : 0) > 0;
  const step2Done = (channels.status === 'fulfilled' ? (channels.value?.cnt ?? 0) : 0) > 0;
  const step3Done = (jobs.status === 'fulfilled' ? (jobs.value?.cnt ?? 0) : 0) > 0;

  return { step1Done, step2Done, step3Done };
}

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
    return null;
  }

  // Non-MASTER users should not be here — send to dashboard
  const tier = await getUserTier(user.id);
  if (tier !== 'MASTER') {
    redirect('/dashboard');
    return null;
  }

  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.onboarding' });

  let step1Done = false;
  let step2Done = false;
  let step3Done = false;

  const d1 = getD1();
  if (d1) {
    try {
      ({ step1Done, step2Done, step3Done } = await loadStepStatus(d1, user.id));
    } catch (e) {
      logger.error('[OnboardingPage] loadStepStatus failed', e instanceof Error ? e : new Error(String(e)));
    }
  }

  const allDone = step1Done && step2Done && step3Done;

  // Auto-complete when all steps are done (server-side, no redirect loop).
  // redirect() invalidates cache automatically — no revalidatePath needed before redirect.
  if (allDone) {
    try {
      await completeOnboardingAction({ reason: 'complete' });
    } catch {
      // non-fatal — redirect proceeds regardless
    }
    redirect('/dashboard');
  }

  const completedCount = [step1Done, step2Done, step3Done].filter(Boolean).length;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t('page_title')}</h1>
        <p className="text-muted-foreground">{t('page_subtitle')}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t('progress', { completed: completedCount, total: 3 })}</span>
          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.round((completedCount / 3) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <OnboardingSteps
        step1Done={step1Done}
        step2Done={step2Done}
        step3Done={step3Done}
      />

      {/* Skip link */}
      <div className="flex justify-center pt-4">
        <SkipButton label={t('skip')} />
      </div>
    </div>
  );
}
