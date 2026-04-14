/**
 * Onboarding API Routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/db/client';
import { resolveToken } from '@/lib/raas/resolve-token';
import { getOrgId } from '@/lib/org';
import { DEFAULT_ONBOARDING_STEPS, calculateProgress } from '@/lib/onboarding/config';
import type { OnboardingStep } from '@/types/onboarding';

// GET /api/onboarding/progress
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Derive orgId from JWT, NOT from query param
    const authClient = createAuthClient(await resolveToken(request));
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serverClient = createServerClient();
    const orgId = await getOrgId(user.id, serverClient);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get onboarding progress
    const { data } = await serverClient
      .from('onboarding_progress')
      .select('steps, progress')
      .eq('org_id', orgId)
      .single();

    if (data) {
      return NextResponse.json(data);
    }

    // Initialize new progress
    return NextResponse.json({
      steps: DEFAULT_ONBOARDING_STEPS,
      progress: 0,
    });
  } catch (error) {
    console.error('Onboarding progress error:', error);
    return NextResponse.json(
      { error: 'Failed to load progress' },
      { status: 500 }
    );
  }
}

// POST /api/onboarding/step/complete
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Derive orgId and userId from JWT, NOT from request body
    const authClient = createAuthClient(await resolveToken(request));
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serverClient = createServerClient();
    const orgId = await getOrgId(user.id, serverClient);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await request.json();
    const { stepId, action } = body;
    const userId = user.id;

    // Get current progress
    const { data: current } = await serverClient
      .from<{ steps: OnboardingStep[] }>('onboarding_progress')
      .select('steps')
      .eq('org_id', orgId)
      .single();

    let steps: OnboardingStep[] = (current?.steps as OnboardingStep[]) || DEFAULT_ONBOARDING_STEPS;

    // Update step
    steps = steps.map((step) =>
      step.id === stepId ? { ...step, completed: true } : step
    );

    const progress = calculateProgress(steps);

    // Upsert progress
    await serverClient.from('onboarding_progress').upsert({
      org_id: orgId,
      steps,
      progress,
      completed_at: progress === 100 ? new Date().toISOString() : null,
    });

    // Log event
    await serverClient.from('onboarding_events').insert({
      user_id: userId,
      org_id: orgId,
      step_id: stepId,
      action,
    });

    // Trigger NPS survey on completion
    if (progress === 100) {
      // Schedule NPS email for day 7
      await serverClient.from('scheduled_emails').insert({
        org_id: orgId,
        template: 'nps_survey',
        send_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return NextResponse.json({ success: true, steps, progress });
  } catch (error) {
    console.error('Step complete error:', error);
    return NextResponse.json(
      { error: 'Failed to complete step' },
      { status: 500 }
    );
  }
}
