/**
 * /onboarding — 3-step resumable onboarding flow.
 * Server Component: auth gate + fetch milestone status → route to correct step.
 * @module app/[locale]/onboarding/page
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
import { OnboardingStepper } from './onboarding-stepper';

export const dynamic = 'force-dynamic';

interface HandoverMilestoneRow {
  customer_first_login_at: number | null;
  customer_first_sop_install_at: number | null;
  customer_first_run_at: number | null;
}

async function getHandoverStatus(userId: string): Promise<HandoverMilestoneRow | null> {
  try {
    const db = await getD1Raw();
    return await db
      .prepare(
        `SELECT customer_first_login_at, customer_first_sop_install_at, customer_first_run_at
         FROM customer_handovers WHERE customer_user_id = ?1 ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(userId)
      .first<HandoverMilestoneRow>();
  } catch {
    return null;
  }
}

function computeInitialStep(row: HandoverMilestoneRow | null): 1 | 2 | 3 {
  if (!row || !row.customer_first_login_at) return 1;
  if (!row.customer_first_sop_install_at) return 2;
  if (!row.customer_first_run_at) return 3;
  return 3; // all done — step 3 shows completion
}

interface OnboardingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const milestones = await getHandoverStatus(user.id);
  const initialStep = computeInitialStep(milestones);

  return (
    <OnboardingStepper
      locale={locale}
      initialStep={initialStep}
      completedSteps={{
        connectivity: !!milestones?.customer_first_login_at,
        api_key: !!milestones?.customer_first_sop_install_at,
        first_run: !!milestones?.customer_first_run_at,
      }}
    />
  );
}
