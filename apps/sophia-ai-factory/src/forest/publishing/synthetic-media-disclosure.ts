/**
 * Backward-compatible re-export of the YouTube synthetic-media disclosure
 * policy. The decision now lives in `tree` because `land` uploaders need it
 * and `land` may not import `forest`.
 *
 * @module forest/publishing/synthetic-media-disclosure
 */

export {
  resolveSyntheticMediaDisclosure,
  allowsYouTubePublish,
  assertYouTubeProvenanceAllowed,
  isProvenanceBlockedError,
  ProvenanceBlockedError,
  PROVENANCE_BLOCKED_PREFIX,
  type SyntheticMediaDisclosure,
  type SyntheticMediaDisclosureInput,
} from '@/tree/publishing/synthetic-media-disclosure';
