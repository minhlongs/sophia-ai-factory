/**
 * GET /api/onboarding/status
 *
 * Get onboarding status and checklist for the current user's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

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

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Get user's organization from request context
    // In a real app, this would come from auth session
    const orgId = request.headers.get('x-org-id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 401 }
      );
    }

    // Get subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier_name, status, mcu_monthly')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .single();

    // Check if user has created any proposals
    const { count: proposalCount } = await supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId);

    // Check if feedback has been submitted
    const { data: feedback } = await supabase
      .from('customer_feedback')
      .select('id')
      .eq('org_id', orgId)
      .limit(1)
      .single();

    // Check if onboarding call has been scheduled
    // This would typically be in a separate table
    let onboardingCall = null;
    try {
      const result = await supabase
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
