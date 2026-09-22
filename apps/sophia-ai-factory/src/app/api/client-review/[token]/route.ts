/**
 * Client Video Review API Endpoint
 *
 * Route: /api/client-review/[token]
 * - GET: Resolves video review payload with client branding
 * - POST: Submits timestamped feedback comments or approve/request_changes decision
 *
 * @module app/api/client-review/[token]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { isReviewTokenExpired } from '@/seed/security/review-token';
import {
  resolveReviewByToken,
  addReviewFeedback,
  submitReviewDecision,
} from '@/tree/organizations/review-service';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<Response> {
  const { token } = await context.params;

  if (!token || !token.trim()) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const payload = await resolveReviewByToken(db, token);
    if (payload.isExpired || (payload.expiresAt && isReviewTokenExpired(payload.expiresAt))) {
      return NextResponse.json(
        { error: 'REVIEW_EXPIRED: Review link has expired' },
        { status: 410 }
      );
    }
    return NextResponse.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('REVIEW_NOT_FOUND')) {
      return NextResponse.json({ error: 'Review link not found or invalid' }, { status: 404 });
    }
    if (message.includes('VALIDATION_ERROR') || message.includes('INVALID_TOKEN')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<Response> {
  const { token } = await context.params;

  if (!token || !token.trim()) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      action?: 'comment' | 'decision';
      comment?: string;
      author?: string;
      timestampSec?: number;
      decision?: 'approve' | 'request_changes';
      feedbackNote?: string;
    };

    if (body.action === 'comment') {
      if (!body.comment?.trim()) {
        return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
      }

      const updatedComments = await addReviewFeedback(db, {
        token,
        comment: body.comment,
        author: body.author,
        timestampSec: body.timestampSec,
      });

      return NextResponse.json({ success: true, comments: updatedComments });
    }

    if (body.action === 'decision') {
      if (!body.decision || (body.decision !== 'approve' && body.decision !== 'request_changes')) {
        return NextResponse.json(
          { error: "Valid decision ('approve' or 'request_changes') is required" },
          { status: 400 }
        );
      }

      const result = await submitReviewDecision(db, {
        token,
        decision: body.decision,
        feedbackNote: body.feedbackNote,
        author: body.author,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Invalid action. Expected 'comment' or 'decision'" },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('REVIEW_NOT_FOUND')) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }
    if (message.includes('REVIEW_EXPIRED')) {
      return NextResponse.json({ error: 'Review link has expired' }, { status: 410 });
    }
    if (message.includes('ALREADY_APPROVED')) {
      return NextResponse.json(
        { error: 'ALREADY_APPROVED: Video has already been approved and scheduled for publishing' },
        { status: 409 }
      );
    }
    if (message.includes('VALIDATION_ERROR') || message.includes('INVALID_TOKEN')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
