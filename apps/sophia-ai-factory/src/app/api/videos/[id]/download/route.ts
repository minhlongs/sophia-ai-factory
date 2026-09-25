/**
 * GET /api/videos/[id]/download
 *
 * Secure 24-Hour HMAC Signed Download Endpoint
 * Validates cryptographic signature token and streams video asset as an attachment.
 * Returns HTTP 403 Forbidden if signature is missing, invalid, or expired.
 *
 * Security:
 * - HMAC-SHA256 URL token validation via Web Crypto API
 * - Replay and hotlinking protection with 24-hour expiration
 * - Refund revocation verification (access_revoked = 1 blocked)
 * - Safe Content-Disposition header with sanitized filename
 *
 * @module app/api/videos/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySignedDownloadToken } from '@/seed/security/signed-url';
import { getD1 } from '@/seed/db/client';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

function getSigningSecret(): string {
  if (typeof process !== 'undefined') {
    return (
      process.env.VIDEO_DOWNLOAD_SIGNING_SECRET ||
      process.env.AUTH_SECRET ||
      process.env.JWT_SECRET ||
      'sophia-edge-download-signing-key-default'
    );
  }
  return 'sophia-edge-download-signing-key-default';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 100);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: videoId } = await params;

  // Extract signed token from query param or header
  const token =
    req.nextUrl.searchParams.get('token') ||
    req.headers.get('x-download-token') ||
    '';

  if (!token) {
    logger.warn('[VideoDownloadRoute] Missing signature token', { videoId });
    return NextResponse.json(
      { error: 'forbidden', message: 'Missing or required download signature token' },
      { status: 403 }
    );
  }

  const secret = getSigningSecret();

  // Verify HMAC-SHA256 signature and expiration
  const verification = await verifySignedDownloadToken({
    token,
    videoId,
    secret,
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
      { status: 403 }
    );
  }

  // Database verification: look up video ownership and state
  try {
    const db = await getD1();
    if (!db) {
      logger.error('[VideoDownloadRoute] D1 binding unavailable', undefined, { videoId });
      return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
    }

    const row = await db
      .prepare(
        `SELECT id, user_id, title, r2_key, access_revoked
         FROM videos
         WHERE id = ?1
         LIMIT 1`
      )
      .bind(videoId)
      .first<{
        id: string;
        user_id: string;
        title?: string | null;
        r2_key: string | null;
        access_revoked: number;
      }>();

    if (!row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (row.access_revoked !== 0) {
      logger.warn('[VideoDownloadRoute] Access revoked for refunded video', { videoId });
      return NextResponse.json({ error: 'access_revoked' }, { status: 403 });
    }

    if (!row.r2_key) {
      return NextResponse.json({ error: 'not_ready', message: 'Video rendering in progress' }, { status: 425 });
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

    const filename = sanitizeFilename(row.title || videoId) + '.mp4';

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType ?? 'video/mp4');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Cache-Control', 'private, no-transform, max-age=86400');
    headers.set('Accept-Ranges', 'bytes');
    if (object.size) {
      headers.set('Content-Length', String(object.size));
    }

    return new Response(object.body, { status: 200, headers });
  } catch (err) {
    logger.error(
      '[VideoDownloadRoute] Unexpected error during download',
      err instanceof Error ? err : undefined,
      { videoId }
    );
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, X-Download-Token',
    },
  });
}
