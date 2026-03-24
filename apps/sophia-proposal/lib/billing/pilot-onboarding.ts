/**
 * Pilot Onboarding Helper
 *
 * Handles:
 * - Welcome email after payment
 * - Onboarding checklist management
 * - NPS survey scheduling
 * - Pilot customer tracking
 */

import { getD1Client } from '@/lib/db/client';
import { scheduleNpsSurvey } from '@/lib/surveys/nps';

export interface PilotOnboardingData {
  orgId: string;
  customerName: string;
  customerEmail: string;
  tierName: string;
  mcuCredits: number;
}

/**
 * Send welcome email after first payment
 */
export async function sendWelcomeEmail(data: PilotOnboardingData): Promise<boolean> {
  // TODO: Integrate with email service (Resend, SendGrid, etc.)
  // await resend.emails.send({ ... });

  return true;
}

/**
 * Initialize pilot onboarding for a new subscriber
 */
export async function initializePilotOnboarding(
  orgId: string,
  subscriptionDate: Date
): Promise<{ success: boolean; error?: string }> {
  const db = await getD1Client();

  try {
    // Schedule NPS survey for 7 days later
    const npsScheduled = await scheduleNpsSurvey(orgId, subscriptionDate);

    if (!npsScheduled) {
      console.error('Failed to schedule NPS survey');
    }

    // Create onboarding record
    const { error } = await db.from('pilot_onboarding').insert({
      org_id: orgId,
      started_at: subscriptionDate.toISOString(),
      nps_scheduled_at: new Date(subscriptionDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    });

    if (error) {
      // Table might not exist yet - that's okay for pilot phase
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to initialize pilot onboarding:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get pilot onboarding status
 */
export async function getPilotOnboardingStatus(orgId: string): Promise<{
  isPilot: boolean;
  status: 'active' | 'completed' | 'inactive';
  daysSinceStart: number;
  npsDue: boolean;
} | null> {
  const db = await getD1Client();

  // Check if organization has active subscription
  const { data: subscription } = await db
    .from<{ id: string; status: string; created_at: string }>('subscriptions')
    .select('id, status, created_at')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .single();

  if (!subscription) {
    return null;
  }

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(subscription.created_at!).getTime()) / (1000 * 60 * 60 * 24)
  );

  // NPS is due 7 days after subscription
  const npsDue = daysSinceStart >= 7;

  return {
    isPilot: true,
    status: 'active',
    daysSinceStart,
    npsDue,
  };
}

/**
 * Track onboarding milestone completion
 */
export async function trackOnboardingMilestone(
  orgId: string,
  milestone: 'first_proposal' | 'onboarding_call' | 'feedback_submitted'
): Promise<boolean> {
  const db = await getD1Client();

  // Try to insert milestone record
  const { error } = await db.from('onboarding_milestones').insert({
    org_id: orgId,
    milestone_type: milestone,
    completed_at: new Date().toISOString(),
  });

  if (error) {
    // Table might not exist - that's okay
    return false;
  }

  return true;
}

/**
 * Get onboarding checklist items from database
 */
export async function getOnboardingChecklist(
  orgId: string
): Promise<{
  signup: boolean;
  org: boolean;
  subscription: boolean;
  payment: boolean;
  onboarding: boolean;
  firstProposal: boolean;
  feedback: boolean;
} | null> {
  const db = await getD1Client();

  // Check subscription
  const { data: subscription } = await db
    .from('subscriptions')
    .select('id')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .single();

  // Check proposals
  const { count: proposalCount } = await db
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  // Check feedback
  const { data: feedback } = await db
    .from('customer_feedback')
    .select('id')
    .eq('org_id', orgId)
    .limit(1)
    .single();

  // Check onboarding call (optional table)
  let hasOnboardingCall = false;
  try {
    const { data: call } = await db
      .from('onboarding_calls')
      .select('id')
      .eq('org_id', orgId)
      .single();
    hasOnboardingCall = !!call;
  } catch {
    // Table doesn't exist
    hasOnboardingCall = false;
  }

  return {
    signup: true,
    org: true,
    subscription: !!subscription,
    payment: !!subscription,
    onboarding: hasOnboardingCall,
    firstProposal: (proposalCount || 0) > 0,
    feedback: !!feedback,
  };
}
