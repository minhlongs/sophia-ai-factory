/**
 * Video Signed Download Route Helpers
 *
 * Signature secret resolution, filename sanitization, D1 lookup, and stream headers.
 */

import { getD1 } from '@/seed/db/client';

type D1Binding = NonNullable<Awaited<ReturnType<typeof getD1>>>;

export interface VideoDownloadRow {
  id: string;
  user_id: string;
  title?: string | null;
  r2_key: string | null;
  access_revoked: number;
}

export const CORS_OPTIONS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range, X-Download-Token',
} as const;

export function getSigningSecret(): string {
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

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 100);
}

export async function lookupVideoDownloadRecord(
  db: D1Binding,
  videoId: string,
): Promise<VideoDownloadRow | null> {
  return await db
    .prepare(
      `SELECT id, user_id, title, r2_key, access_revoked
       FROM videos
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(videoId)
    .first<VideoDownloadRow>();
}

export function buildVideoStreamResponse(
  object: {
    body: BodyInit | null;
    size?: number;
    httpMetadata?: { contentType?: string };
  },
  title: string | null | undefined,
  videoId: string,
): Response {
  const filename = sanitizeFilename(title || videoId) + '.mp4';

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'video/mp4');
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Cache-Control', 'private, no-transform, max-age=86400');
  headers.set('Accept-Ranges', 'bytes');
  if (object.size) {
    headers.set('Content-Length', String(object.size));
  }

  return new Response(object.body, { status: 200, headers });
}
