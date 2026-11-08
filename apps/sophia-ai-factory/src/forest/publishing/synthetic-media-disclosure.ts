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
 * Layer: forest (orchestration — imports tree for the provenance review)
 * @module forest/publishing/synthetic-media-disclosure
 */

import {
  buildProvenance,
  type ProvenanceInput,
  type ProvenanceRecord,
} from '@/tree/youtube-strategy/provenance-reviewer';

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
  // missing-disclosure risk this module exists to prevent. The default is
  // resolved here, at the boundary, so the record carries the intended value.
  const provenanceInput: ProvenanceInput = {
    containsSyntheticMedia: defaultContainsSyntheticMedia,
    ...(input.provenance ?? {}),
  };

  const record: ProvenanceRecord = buildProvenance(provenanceInput);
  const blocked = record.status === 'blocked';

  return {
    containsSyntheticMedia: record.containsSyntheticMedia,
    provenanceStatus: record.status,
    blocked,
    blockedReason: blocked
      ? 'The content review left claims without a verified source, so the video was not published.'
      : undefined,
    blockedReasonVi: blocked
      ? 'Bộ kiểm tra nội dung còn có khẳng định chưa xác minh được nguồn nên video chưa được đăng.'
      : undefined,
    unresolvedClaimCount: record.summary.unresolvedClaims,
  };
}

/** Whether a disclosure result still permits the upload to proceed. */
export function allowsYouTubePublish(disclosure: SyntheticMediaDisclosure): boolean {
  return !disclosure.blocked;
}
