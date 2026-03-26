/**
 * GET /api/onboarding/status
 *
 * Get onboarding status and checklist for the current user's organization
 */

import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/raas/auth-context';
import { createServerClient } from '@/lib/db/client';
import type { Subscription } from '@/lib/db/types';

export interface OnboardingStatus {
  orgId: string;
  isPilot: boolean;
  checklist: {
    signup: boolean;
    org: boolean;
    subscription: boolean;
    payment: boolean;
    onboarding: boolean;
    firstProposal: boolean;
    feedback: boolean;
  };
  subscription?: {
    tierName: string;
    status: string;
    mcuMonthly: number;
  };
}

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = createServerClient();
    const orgId = auth.orgId;

    // Get subscription status
    const { data: subscription } = await db
      .from<Subscription>('subscriptions')
      .select('tier_name, status, mcu_monthly')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .single();

    // Check if user has created any proposals
    const { count: proposalCount } = await db
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    // Check if feedback has been submitted
    const { data: feedback } = await db
      .from('customer_feedback')
      .select('id')
      .eq('org_id', orgId)
      .limit(1)
      .single();

    // Check if onboarding call has been scheduled
    // This would typically be in a separate table
    let onboardingCall = null;
    try {
      const result = await db
        .from('onboarding_calls')
        .select('id')
        .eq('org_id', orgId)
        .limit(1)
        .single();
      onboardingCall = result.data;
    } catch {
      // Table might not exist yet
      onboardingCall = null;
    }

    const hasSubscription = !!subscription;
    const hasFirstProposal = (proposalCount || 0) > 0;
    const hasFeedback = !!feedback;
    const hasOnboardingCall = !!onboardingCall;

    const checklist = {
      signup: true, // If they can access this endpoint, they're signed up
      org: true, // Same for org creation
      subscription: hasSubscription,
      payment: hasSubscription, // Payment completed if subscription is active
      onboarding: hasOnboardingCall,
      firstProposal: hasFirstProposal,
      feedback: hasFeedback,
    };

    const status: OnboardingStatus = {
      orgId,
      isPilot: hasSubscription, // Simplified: any active subscriber is a pilot
      checklist,
      subscription: subscription
        ? {
            tierName: subscription.tier_name,
            status: subscription.status,
            mcuMonthly: subscription.mcu_monthly,
          }
        : undefined,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Onboarding status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
