/**
 * POST /api/feedback
 *
 * Submit customer feedback (NPS, onboarding, churn surveys)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/db/client';
import { resolveToken } from '@/lib/raas/resolve-token';
import { getOrgId } from '@/lib/org';

export interface FeedbackRequest {
  surveyType: 'nps' | 'onboarding' | 'churn';
  responses: Record<string, unknown>;
  npsScore?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json();
    const { surveyType, responses, npsScore } = body;

    // Validate input
    if (!surveyType) {
      return NextResponse.json(
        { error: 'surveyType is required' },
        { status: 400 }
      );
    }

    if (!responses || typeof responses !== 'object') {
      return NextResponse.json(
        { error: 'responses must be an object' },
        { status: 400 }
      );
    }

    if (surveyType === 'nps' && (npsScore === undefined || npsScore === null)) {
      return NextResponse.json(
        { error: 'npsScore is required for NPS surveys' },
        { status: 400 }
      );
    }

    if (npsScore !== undefined && (npsScore < 0 || npsScore > 10)) {
      return NextResponse.json(
        { error: 'npsScore must be between 0 and 10' },
        { status: 400 }
      );
    }

    // SECURITY: Derive orgId from JWT, NOT from user-controllable header
    const authClient = createAuthClient(await resolveToken(request));
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServerClient();
    const orgId = await getOrgId(user.id, db);
    if (!orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Insert feedback
    const { error } = await db.from('customer_feedback').insert({
      org_id: orgId,
      survey_type: surveyType,
      responses,
      nps_score: npsScore || null,
    });

    if (error) {
      console.error('Failed to insert feedback:', error);
      return NextResponse.json(
        { error: 'Failed to submit feedback', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
