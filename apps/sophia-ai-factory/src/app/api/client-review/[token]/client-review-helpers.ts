/**
 * Client Video Review API Helpers
 *
 * @module app/api/client-review/[token]/client-review-helpers
 */

import { NextResponse } from 'next/server';
import {
  addReviewFeedback,
  submitReviewDecision,
} from '@/tree/organizations/review-service';
import type { D1Database } from '@cloudflare/workers-types';

export interface ClientReviewPostBody {
  action?: 'comment' | 'decision';
  comment?: string;
  author?: string;
  timestampSec?: number;
  decision?: 'approve' | 'request_changes';
  feedbackNote?: string;
}

export function mapGetReviewError(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('REVIEW_NOT_FOUND')) {
    return NextResponse.json({ error: 'Review link not found or invalid' }, { status: 404 });
  }
  if (message.includes('VALIDATION_ERROR') || message.includes('INVALID_TOKEN')) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

export function mapPostReviewError(err: unknown): Response {
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
      { status: 409 },
    );
  }
  if (message.includes('VALIDATION_ERROR') || message.includes('INVALID_TOKEN')) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function dispatchReviewPostAction(
  db: D1Database,
  token: string,
  body: ClientReviewPostBody,
): Promise<Response> {
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
        { status: 400 },
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
    { status: 400 },
  );
}
