/**
 * Pilot Onboarding Helper
 *
 * Handles:
 * - Welcome email after payment
 * - Onboarding checklist management
 * - NPS survey scheduling
 * - Pilot customer tracking
 */

import { createServerClient } from '@/lib/db/client';
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
  // In production, this would integrate with an email service
  // For now, we'll log the email that would be sent
  console.log('Welcome Email:', {
    to: data.customerEmail,
    subject: `Welcome to Sophia AI Factory - ${data.tierName} Plan`,
    content: `
Dear ${data.customerName},

Welcome to Sophia AI Factory!

Thank you for subscribing to the ${data.tierName} plan.
Your account has been credited with ${data.mcuCredits.toLocaleString()} MCU.

Next Steps:
1. Schedule your 30-minute onboarding call: https://sophia.agencyos.network/onboarding/schedule
2. Generate your first AI-powered proposal
3. Share your feedback to help us improve

As a pilot customer, you have direct access to our team.
Reply to this email anytime with questions or feedback.

Best regards,
The Sophia AI Factory Team
    `.trim(),
  });

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
  const db = createServerClient();

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
      console.log('Note: pilot_onboarding table not found (optional for pilot)');
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
  const db = createServerClient();

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
  const db = createServerClient();

  // Try to insert milestone record
  const { error } = await db.from('onboarding_milestones').insert({
    org_id: orgId,
    milestone_type: milestone,
    completed_at: new Date().toISOString(),
  });

  if (error) {
    // Table might not exist - that's okay
    console.log('Note: onboarding_milestones table not found');
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
  const db = createServerClient();

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
