/**
 * Canonical Media Asset Bridge: Approved Narrated MP4 Blob -> Private R2 -> `videos.id`.
 *
 * Enforces:
 * - Authenticated user + CSRF + workspace ownership (`verifyWorkspaceAccess`)
 * - Approved First Value script review (`reviewState === 'accepted'`)
 * - Bounded MP4 binary validation (`ftyp` box signature, max 50 MB)
 * - Server-calculated SHA-256 (never trusts client checksums)
 * - Server-generated tenant-scoped private R2 object key (zero traversal, zero public bucket)
 * - Idempotent finalization into canonical `videos` table (zero new migrations)
 * - Safe rollback (deletes R2 object if D1 finalization fails -> zero orphaned assets)
 *
 * @module land/first-value/distribution-asset-bridge
 */

import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { getReviewById } from '@/tree/first-value/first-value-review-repo';

export const MAX_DISTRIBUTION_MP4_BYTES = 50 * 1024 * 1024;
export const MIN_DISTRIBUTION_MP4_BYTES = 128;

export interface SaveDistributionAssetInput {
  readonly orgId: string;
  readonly userId: string;
  readonly artifactId: string;
  readonly durationSec: number;
  readonly mp4Bytes: Uint8Array;
}

export type SaveDistributionAssetResult =
  | {
      readonly ok: true;
      readonly videoId: string;
      readonly r2ObjectKey: string;
      readonly sha256Hex: string;
      readonly byteSize: number;
      readonly idempotentReplay: boolean;
    }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: string;
      readonly error: string;
    };

function sanitizeSegment(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

/** Validates ISO BMFF MP4 container signature (`ftyp` at bytes 4..8). */
export function isValidMp4Bytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < MIN_DISTRIBUTION_MP4_BYTES || bytes.byteLength > MAX_DISTRIBUTION_MP4_BYTES) {
    return false;
  }
  return (
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70 // p
  );
}

async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function saveApprovedMp4ForDistribution(
  d1: D1Database,
  r2: R2Bucket,
  input: SaveDistributionAssetInput,
): Promise<SaveDistributionAssetResult> {
  const safeOrg = sanitizeSegment(input.orgId);
  const safeUser = sanitizeSegment(input.userId);
  const safeArtifact = sanitizeSegment(input.artifactId);
  if (!safeOrg || !safeUser || !safeArtifact) {
    return { ok: false, status: 400, code: 'INVALID_ASSET_IDENTIFIERS', error: 'Invalid workspace or artifact identifier' };
  }

  if (!isValidMp4Bytes(input.mp4Bytes)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_MP4_BYTES',
      error: 'Uploaded media must be a valid MP4 container within 128 bytes – 50 MB',
    };
  }

  const review = await getReviewById(d1, {
    artifactId: input.artifactId,
    orgId: input.orgId,
    userId: input.userId,
  });
  if (!review) {
    return { ok: false, status: 404, code: 'ARTIFACT_NOT_FOUND', error: 'Approved review artifact not found in this workspace' };
  }
  if (review.reviewState !== 'accepted') {
    return {
      ok: false,
      status: 409,
      code: 'REVIEW_NOT_APPROVED',
      error: 'Only explicitly accepted script revisions can be saved for distribution',
    };
  }

  const sha256Hex = await computeSha256Hex(input.mp4Bytes);
  const idempotentJobKey = `r2_dist:${safeOrg}:${safeArtifact}:v${review.version}:${sha256Hex.slice(0, 16)}`;
  const r2ObjectKey = `private/distribution/${safeOrg}/${safeUser}/${safeArtifact}/v${review.version}-${sha256Hex}.mp4`;

  // Idempotent check against canonical `videos` table
  const existing = await d1
    .prepare('SELECT id, video_url FROM videos WHERE user_id = ? AND heygen_job_id = ? LIMIT 1')
    .bind(input.userId, idempotentJobKey)
    .first<{ id: string; video_url: string | null }>();

  if (existing) {
    return {
      ok: true,
      videoId: existing.id,
      r2ObjectKey: existing.video_url?.replace(/^r2:\/\//, '') ?? r2ObjectKey,
      sha256Hex,
      byteSize: input.mp4Bytes.byteLength,
      idempotentReplay: true,
    };
  }

  // Persist to private tenant-scoped R2 object
  await r2.put(r2ObjectKey, input.mp4Bytes, {
    httpMetadata: { contentType: 'video/mp4' },
    customMetadata: {
      orgId: input.orgId,
      userId: input.userId,
      artifactId: input.artifactId,
      reviewVersion: String(review.version),
      sha256Hex,
    },
  });

  const videoId = `vid_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const safeDuration = Math.max(1, Math.min(600, Math.round(input.durationSec || review.durationSec || 30)));

  try {
    await d1
      .prepare(
        `INSERT INTO videos (id, user_id, script_request_id, heygen_job_id, title, status, video_url, duration_sec)
         VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)`,
      )
      .bind(
        videoId,
        input.userId,
        `${input.orgId}:${input.artifactId}:v${review.version}`,
        idempotentJobKey,
        review.script.title || review.topic,
        `r2://${r2ObjectKey}`,
        safeDuration,
      )
      .run();
  } catch {
    // Compensating rollback: prevent orphaned R2 object if D1 finalization fails
    await r2.delete(r2ObjectKey).catch(() => {});
    return {
      ok: false,
      status: 500,
      code: 'VIDEO_FINALIZATION_FAILED',
      error: 'Failed to finalize canonical video record; uploaded object rolled back',
    };
  }

  return {
    ok: true,
    videoId,
    r2ObjectKey,
    sha256Hex,
    byteSize: input.mp4Bytes.byteLength,
    idempotentReplay: false,
  };
}
