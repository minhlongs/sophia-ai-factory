/**
 * Publish Idempotency Key
 * Layer: TREE (domain-specific reusable)
 *
 * The ledger key has to answer one question exactly: "is this the same publish
 * I already approved or already shipped?" A job id cannot answer it, because
 * Inngest re-delivers an event with the same job id and a cron replay inserts a
 * brand new job id for the same media. The key is therefore derived from what
 * stays constant across both: the workspace, the channel, the platform, and the
 * media itself.
 *
 * @module tree/publishing/approval/idempotency-key
 */

import type { PublishApprovalSubject } from './types';

/** Deterministic separator that cannot appear inside a normalized field. */
const FIELD_SEPARATOR = '␟';

function normalizeIdentifier(value: string): string {
  return value.trim();
}

function normalizePlatform(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Builds the canonical string the ledger hashes. Identifiers (`tenantId`,
 * `channelId`, `mediaRef`) are trimmed only, never lowercased: folding case on
 * `tenantId` would let two workspaces whose ids differ only in case share one
 * ledger row, and folding case on `mediaRef` would collapse two distinct URL
 * paths into one key. Only the platform name is case-folded.
 */
export function canonicalizePublishSubject(subject: PublishApprovalSubject): string {
  return [
    normalizeIdentifier(subject.tenantId),
    normalizeIdentifier(subject.channelId),
    normalizePlatform(subject.platform),
    normalizeIdentifier(subject.mediaRef),
  ].join(FIELD_SEPARATOR);
}

/** Lowercase hex SHA-256 of the canonical subject string. */
export async function computePublishIdempotencyKey(
  subject: PublishApprovalSubject,
): Promise<string> {
  const canonical = canonicalizePublishSubject(subject);
  const encoded = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
