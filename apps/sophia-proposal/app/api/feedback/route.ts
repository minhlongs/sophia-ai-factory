/**
 * POST /api/feedback
 *
 * Submit customer feedback (NPS, onboarding, churn surveys)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

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

    // For server-side feedback submission (webhooks, etc.)
    // If orgId is provided in the request, use it directly
    const authHeader = request.headers.get('authorization');
    let orgId: string | null = null;

    // Check for org context in header (from middleware or client)
    const orgIdHeader = request.headers.get('x-org-id');
    if (orgIdHeader) {
      orgId = orgIdHeader;
    }

    // If no org context, this might be a public endpoint
    // In a real app, you'd validate auth here
    if (!orgId) {
      // For browser-based submissions, we expect the org context
      // to be available via session/auth
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Insert feedback
    const { error } = await supabase.from('customer_feedback').insert({
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
