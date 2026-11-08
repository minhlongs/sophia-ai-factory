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

function normalizeField(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Builds the canonical string the ledger hashes. Exported so the invariant —
 * that changing any subject field changes the key, and normalizing only case
 * and surrounding whitespace — is directly testable.
 */
export function canonicalizePublishSubject(subject: PublishApprovalSubject): string {
  return [
    normalizeField(subject.tenantId),
    normalizeField(subject.channelId),
    normalizeField(subject.platform),
    normalizeField(subject.mediaRef),
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
