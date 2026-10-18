/**
 * GET /api/videos/[id]/download
 *
 * Secure 24-Hour HMAC Signed Download Endpoint
 * Validates cryptographic signature token and streams video asset as an attachment.
 * Returns HTTP 403 Forbidden if signature is missing, invalid, or expired.
 *
 * @module app/api/videos/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySignedDownloadToken } from '@/seed/security/signed-url';
import { getD1 } from '@/seed/db/client';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { logger } from '@/seed/utils/logger-utility';
import {
  CORS_OPTIONS_HEADERS,
  buildVideoStreamResponse,
  getSigningSecret,
  lookupVideoDownloadRecord,
} from './video-download-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: videoId } = await params;

  const token =
    req.nextUrl.searchParams.get('token') ||
    req.headers.get('x-download-token') ||
    '';

  if (!token) {
    logger.warn('[VideoDownloadRoute] Missing signature token', { videoId });
    return NextResponse.json(
      { error: 'forbidden', message: 'Missing or required download signature token' },
      { status: 403 },
    );
  }

  const verification = await verifySignedDownloadToken({
    token,
    videoId,
    secret: getSigningSecret(),
  });

  if (!verification.valid) {
    logger.warn('[VideoDownloadRoute] Signature verification failed', {
      videoId,
      expired: verification.expired,
    });
    return NextResponse.json(
      {
        error: 'forbidden',
        reason: verification.expired ? 'token_expired' : 'invalid_signature',
        message: verification.expired
          ? 'Download link has expired (24h limit exceeded)'
          : 'Invalid or forged download signature',
      },
      { status: 403 },
    );
  }

  try {
    const db = await getD1();
    if (!db) {
      logger.error('[VideoDownloadRoute] D1 binding unavailable', undefined, { videoId });
      return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
    }

    const row = await lookupVideoDownloadRecord(db, videoId);
    if (!row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (row.access_revoked !== 0) {
      logger.warn('[VideoDownloadRoute] Access revoked for refunded video', { videoId });
      return NextResponse.json({ error: 'access_revoked' }, { status: 403 });
    }

    if (!row.r2_key) {
      return NextResponse.json(
        { error: 'not_ready', message: 'Video rendering in progress' },
        { status: 425 },
      );
    }

    const r2ref = await getVideoBucket();
    if (!r2ref) {
      logger.error('[VideoDownloadRoute] R2 bucket unavailable', undefined, { videoId });
      return NextResponse.json({ error: 'r2_unavailable' }, { status: 503 });
    }

    const object = await r2ref.bucket.get(row.r2_key);
    if (!object) {
      logger.error('[VideoDownloadRoute] R2 object not found', undefined, {
        videoId,
        r2Key: row.r2_key,
      });
      return NextResponse.json({ error: 'not_ready' }, { status: 425 });
    }

    return buildVideoStreamResponse(object, row.title, videoId);
  } catch (err) {
    logger.error(
      '[VideoDownloadRoute] Unexpected error during download',
      err instanceof Error ? err : undefined,
      { videoId },
    );
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_OPTIONS_HEADERS,
  });
}
