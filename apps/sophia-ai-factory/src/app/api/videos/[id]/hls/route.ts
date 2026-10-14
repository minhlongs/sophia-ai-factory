/**
 * GET /api/videos/[id]/hls
 *
 * Serves Adaptive Bitrate Master HLS Playlist (.m3u8)
 * Conforms to RFC 8216 with edge CDN caching and multi-variant quality ladders:
 * - 1080p: 5000 kbps (1920x1080)
 * - 720p:  2800 kbps (1280x720)
 * - 480p:  1400 kbps (854x480)
 *
 * Headers:
 * - Content-Type: application/vnd.apple.mpegurl
 * - Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=86400
 * - CORS: Access-Control-Allow-Origin: *
 *
 * @module app/api/videos/[id]/hls
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateMasterManifest } from '@/forest/streaming/hls-manifest-generator';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  HLS_CORS_HEADERS,
  buildStandardAudioTracks,
  buildStandardSubtitleTracks,
} from './hls-route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: videoId } = await params;

  try {
    const db = await getD1();
    if (!db) {
      logger.error('[VideoHlsRoute] D1 binding unavailable', undefined, { videoId });
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
      logger.warn('[VideoHlsRoute] Access revoked for refunded video', { videoId });
      return NextResponse.json({ error: 'access_revoked' }, { status: 403 });
    }

    // Determine playback base URL
    const origin = req.nextUrl.origin;
    const basePlaybackUrl = `${origin}/api/videos/${encodeURIComponent(videoId)}`;

    const masterManifest = generateMasterManifest({
      basePlaybackUrl,
      audioTracks: buildStandardAudioTracks(basePlaybackUrl),
      subtitles: buildStandardSubtitleTracks(basePlaybackUrl),
      independentSegments: true,
    });

    const headers = new Headers(HLS_CORS_HEADERS);
    headers.set('Content-Type', 'application/vnd.apple.mpegurl');
    headers.set(
      'Cache-Control',
      'public, max-age=300, s-maxage=600, stale-while-revalidate=86400'
    );

    return new Response(masterManifest, { status: 200, headers });
  } catch (err) {
    logger.error(
      '[VideoHlsRoute] Error generating master manifest',
      err instanceof Error ? err : undefined,
      { videoId }
    );
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: HLS_CORS_HEADERS });
}
