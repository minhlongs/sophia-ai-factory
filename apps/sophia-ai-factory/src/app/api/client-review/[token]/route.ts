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
import { resolveReviewByToken } from '@/tree/organizations/review-service';
import {
  type ClientReviewPostBody,
  dispatchReviewPostAction,
  mapGetReviewError,
  mapPostReviewError,
} from './client-review-helpers';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    token: string;
  }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
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
        { status: 410 },
      );
    }
    return NextResponse.json(payload);
  } catch (err: unknown) {
    return mapGetReviewError(err);
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
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
    const body = (await request.json()) as ClientReviewPostBody;
    return await dispatchReviewPostAction(db, token, body);
  } catch (err: unknown) {
    return mapPostReviewError(err);
  }
}
