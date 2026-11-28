/**
 * Authorized Private Media Resolver for Omnichannel Publishing.
 *
 * Resolves server-generated canonical `r2://private/distribution/...` URIs
 * exclusively from `MEDIA_BUCKET` (never `BACKUPS_BUCKET`, never public URLs),
 * enforcing workspace/user ownership and verifying SHA-256 byte integrity
 * before bytes reach any provider adapter.
 *
 * Also provides cryptographic media-approval payload binding so publishing
 * approvals are tied to the exact persisted MP4 SHA-256, workspace, channel,
 * caption, and schedule.
 *
 * @module land/video/publishing/private-media-resolver
 */

import type { R2Bucket } from '@cloudflare/workers-types';

/** Safe prototype cap for Workers 128 MB isolate memory budget (25 MB raw + buffer + hash). */
export const MAX_RESOLVED_PRIVATE_MEDIA_BYTES = 25 * 1024 * 1024;

const CANONICAL_PRIVATE_R2_RE =
  /^r2:\/\/(private\/distribution\/([a-zA-Z0-9_-]{1,64})\/([a-zA-Z0-9_-]{1,64})\/([a-zA-Z0-9_-]{1,64})\/v(\d+)-([a-f0-9]{64})\.mp4)$/;

export interface ParsedCanonicalPrivateR2Uri {
  readonly objectKey: string;
  readonly orgId: string;
  readonly userId: string;
  readonly artifactId: string;
  readonly reviewVersion: number;
  readonly sha256Hex: string;
}

export interface ResolvedPrivateMedia {
  readonly bytes: Uint8Array;
  readonly byteSize: number;
  readonly contentType: string;
  readonly sha256Hex: string;
  readonly objectKey: string;
  readonly orgId: string;
  readonly userId: string;
  readonly artifactId: string;
  readonly reviewVersion: number;
}

export interface MediaApprovalBindingInput {
  readonly orgId: string;
  readonly videoId: string;
  readonly sha256Hex: string;
  readonly reviewVersion: number;
  readonly channelId: string;
  readonly caption: string;
  readonly scheduledAt: number;
}

interface MediaEnv {
  MEDIA_BUCKET?: R2Bucket;
}

export function isCanonicalPrivateR2Uri(uri: string): boolean {
  return CANONICAL_PRIVATE_R2_RE.test(uri);
}

export function parseCanonicalPrivateR2Uri(uri: string): ParsedCanonicalPrivateR2Uri | null {
  if (typeof uri !== 'string' || uri.includes('..')) return null;
  const match = CANONICAL_PRIVATE_R2_RE.exec(uri);
  if (!match) return null;
  const [, objectKey, orgId, userId, artifactId, versionStr, sha256Hex] = match;
  const reviewVersion = Number.parseInt(versionStr, 10);
  if (!Number.isFinite(reviewVersion) || reviewVersion < 1) return null;
  return { objectKey, orgId, userId, artifactId, reviewVersion, sha256Hex };
}

export function resolveMediaBucketFromRuntime(): R2Bucket | null {
  try {
    const g = globalThis as unknown as Record<string, MediaEnv | undefined>;
    const env = g.__env__ ?? g.__env;
    if (env?.MEDIA_BUCKET) return env.MEDIA_BUCKET;
    const ctx = (globalThis as Record<symbol, { env?: MediaEnv }>)[Symbol.for('__cloudflare-context__')];
    return ctx?.env?.MEDIA_BUCKET ?? null;
  } catch {
    return null;
  }
}

async function sha256HexOfBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolves a canonical `r2://private/distribution/...` URI from `MEDIA_BUCKET`,
 * verifying workspace/user ownership, bounded byte size, and SHA-256 integrity.
 */
export async function resolvePrivateMediaFromR2(args: {
  readonly uri: string;
  readonly expectedUserId?: string;
  readonly expectedOrgId?: string;
  readonly r2?: R2Bucket | null;
}): Promise<ResolvedPrivateMedia> {
  const parsed = parseCanonicalPrivateR2Uri(args.uri);
  if (!parsed) {
    throw new Error('[privateMediaResolver] Invalid or non-canonical private R2 URI');
  }

  if (args.expectedUserId && parsed.userId !== args.expectedUserId) {
    throw new Error('[privateMediaResolver] Cross-user private media access denied');
  }
  if (args.expectedOrgId && parsed.orgId !== args.expectedOrgId) {
    throw new Error('[privateMediaResolver] Cross-workspace private media access denied');
  }

  const bucket = args.r2 ?? resolveMediaBucketFromRuntime();
  if (!bucket) {
    throw new Error('[privateMediaResolver] MEDIA_BUCKET binding unavailable (fail-closed)');
  }

  const obj = await bucket.get(parsed.objectKey);
  if (!obj) {
    throw new Error('[privateMediaResolver] Private media object not found in MEDIA_BUCKET');
  }

  const buf = await obj.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > MAX_RESOLVED_PRIVATE_MEDIA_BYTES) {
    throw new Error(`[privateMediaResolver] Media object size out of bounds (${buf.byteLength} bytes)`);
  }

  const bytes = new Uint8Array(buf);
  const actualSha256 = await sha256HexOfBytes(bytes);
  if (actualSha256 !== parsed.sha256Hex) {
    throw new Error('[privateMediaResolver] Media integrity mismatch: SHA-256 does not match canonical URI');
  }

  const metaSha = obj.customMetadata?.sha256Hex;
  if (metaSha && metaSha !== actualSha256) {
    throw new Error('[privateMediaResolver] Media integrity mismatch: SHA-256 does not match R2 metadata');
  }

  return {
    bytes,
    byteSize: bytes.byteLength,
    contentType: obj.httpMetadata?.contentType ?? 'video/mp4',
    sha256Hex: actualSha256,
    objectKey: parsed.objectKey,
    orgId: parsed.orgId,
    userId: parsed.userId,
    artifactId: parsed.artifactId,
    reviewVersion: parsed.reviewVersion,
  };
}

/**
 * Computes a deterministic SHA-256 binding digest tying a publishing approval
 * to the exact workspace, canonical video ID, persisted MP4 SHA-256, approved
 * script revision, target channel, caption, and scheduled timestamp.
 */
export async function computeMediaApprovalDigest(input: MediaApprovalBindingInput): Promise<string> {
  const canonicalPayload = JSON.stringify({
    orgId: input.orgId,
    videoId: input.videoId,
    sha256Hex: input.sha256Hex,
    reviewVersion: input.reviewVersion,
    channelId: input.channelId,
    caption: input.caption,
    scheduledAt: input.scheduledAt,
  });
  return sha256HexOfBytes(new TextEncoder().encode(canonicalPayload));
}
