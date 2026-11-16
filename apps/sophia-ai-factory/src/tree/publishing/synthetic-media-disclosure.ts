/**
 * Synthetic-media disclosure resolution for YouTube uploads.
 *
 * YouTube requires `status.containsSyntheticMedia` on every video that is
 * synthetic or was meaningfully altered, and withholds monetization when the
 * disclosure is missing. Sophia generates every video it publishes, so the
 * disclosure must never be an accident of whatever a caller happened to pass.
 *
 * This module is the one place the decision is made. It runs the provenance
 * review (the claim/source check that already exists for YouTube content) and
 * turns its record into the exact flag the upload metadata needs, plus the
 * decision of whether an unresolved provenance review should block the publish
 * rather than quietly ship an unsupported claim.
 *
 * Layer: tree (domain — YouTube disclosure policy, shared by every upload path.
 * It lives here, above forest and land, so the tree, forest, and land uploaders
 * cannot disagree about the disclosure a YouTube video must carry.)
 * @module tree/publishing/synthetic-media-disclosure
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  buildProvenance,
  type ProvenanceInput,
  type ProvenanceRecord,
} from '@/tree/youtube-strategy/provenance-reviewer';

/** Prefix attached to deterministic YouTube provenance-gate rejections. */
export const PROVENANCE_BLOCKED_PREFIX = 'PROVENANCE_BLOCKED:';

const INVALID_PROVENANCE_VI_SUFFIX = '(Hồ sơ nguồn xác minh không hợp lệ)';
const MAX_PERSISTED_ERROR_LENGTH = 200;

/**
 * Typed error raised when a YouTube upload is rejected by the provenance gate.
 * Preserves the `PROVENANCE_BLOCKED:` message prefix for serialized boundaries
 * while allowing `instanceof` checks in in-memory callers.
 */
export class ProvenanceBlockedError extends Error {
  constructor(message: string) {
    super(
      message.startsWith(PROVENANCE_BLOCKED_PREFIX)
        ? message
        : `${PROVENANCE_BLOCKED_PREFIX} ${message}`,
    );
    this.name = 'ProvenanceBlockedError';
  }
}

export interface SyntheticMediaDisclosureInput {
  /** The provenance record to build, when the caller has one. */
  readonly provenance?: ProvenanceInput;
  /** Fallback disclosure when no provenance record was supplied. */
  readonly defaultContainsSyntheticMedia?: boolean;
}

export interface SyntheticMediaDisclosure {
  /** The value that must appear in `status.containsSyntheticMedia`. */
  readonly containsSyntheticMedia: boolean;
  /** Outcome of the provenance review that produced this disclosure. */
  readonly provenanceStatus: ProvenanceRecord['status'];
  /** Whether the publish should not proceed at all. */
  readonly blocked: boolean;
  /** Bilingual operator-facing reason, present only when blocked. */
  readonly blockedReason?: string;
  readonly blockedReasonVi?: string;
  readonly unresolvedClaimCount: number;
}

function formatStructuralProvenanceError(raw: string): string {
  if (raw.startsWith(PROVENANCE_BLOCKED_PREFIX)) {
    return raw.length <= MAX_PERSISTED_ERROR_LENGTH
      ? raw
      : `${raw.slice(0, MAX_PERSISTED_ERROR_LENGTH - 3)}...`;
  }
  // Keep total message <= 200 chars so downstream sanitizeError never truncates
  // the trailing Vietnamese translation when source URLs or IDs are long.
  const maxRawLength =
    MAX_PERSISTED_ERROR_LENGTH -
    PROVENANCE_BLOCKED_PREFIX.length -
    INVALID_PROVENANCE_VI_SUFFIX.length -
    2;
  const boundedRaw =
    raw.length <= maxRawLength ? raw : `${raw.slice(0, maxRawLength - 3)}...`;
  return `${PROVENANCE_BLOCKED_PREFIX} ${boundedRaw} ${INVALID_PROVENANCE_VI_SUFFIX}`;
}

/**
 * Runs the provenance review and reduces it to the disclosure a YouTube upload
 * must carry.
 *
 * A `blocked` provenance status stops the publish: it means at least one claim
 * was left unsupported by a verified source, which is the failure mode that
 * turns into a strike or a takedown for the channel owner.
 */
export function resolveSyntheticMediaDisclosure(
  input: SyntheticMediaDisclosureInput = {},
): SyntheticMediaDisclosure {
  const defaultContainsSyntheticMedia = input.defaultContainsSyntheticMedia ?? true;
  // `buildProvenance` defaults an absent flag to `false`, which is exactly the
  // missing-disclosure risk this module exists to prevent. Resolve after spread
  // so an explicit `{ containsSyntheticMedia: undefined }` cannot erase `true`.
  const provenanceInput: ProvenanceInput = {
    ...(input.provenance ?? {}),
    containsSyntheticMedia:
      input.provenance?.containsSyntheticMedia ?? defaultContainsSyntheticMedia,
  };

  let record: ProvenanceRecord;
  try {
    record = buildProvenance(provenanceInput);
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    logger.warn('[SyntheticMediaDisclosure] Structural provenance validation failed', {
      reason: raw.slice(0, 160),
    });
    throw new ProvenanceBlockedError(formatStructuralProvenanceError(raw));
  }
  const blocked = record.status === 'blocked';

  return {
    containsSyntheticMedia: record.containsSyntheticMedia,
    provenanceStatus: record.status,
    blocked,
    blockedReason: blocked
      ? 'The content review left claims without a verified source, so the video was not published'
      : undefined,
    blockedReasonVi: blocked
      ? 'Bộ kiểm tra nội dung còn có khẳng định chưa xác minh được nguồn nên video chưa được đăng'
      : undefined,
    unresolvedClaimCount: record.summary.unresolvedClaims,
  };
}

/** Whether a disclosure result still permits the upload to proceed. */
export function allowsYouTubePublish(disclosure: SyntheticMediaDisclosure): boolean {
  return !disclosure.blocked;
}

/**
 * Throws a deterministic bilingual `PROVENANCE_BLOCKED` error when the
 * provenance review left claims unresolved. Callers run this synchronously
 * before touching shared circuit breakers or provider HTTP endpoints.
 */
export function assertYouTubeProvenanceAllowed(disclosure: SyntheticMediaDisclosure): void {
  if (!allowsYouTubePublish(disclosure)) {
    throw new ProvenanceBlockedError(
      `${PROVENANCE_BLOCKED_PREFIX} ${disclosure.blockedReason} (${disclosure.blockedReasonVi})`,
    );
  }
}

/** True when an error originated from a deterministic provenance-gate rejection. */
export function isProvenanceBlockedError(err: unknown): boolean {
  if (err instanceof ProvenanceBlockedError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith(PROVENANCE_BLOCKED_PREFIX);
}
