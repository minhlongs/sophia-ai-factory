export type { ClipTranscriptWord, MergedClip } from './merger/types';
export {
  SNAP_TOLERANCE_MS,
  MIN_CLIP_MS,
  SENTENCE_TOLERANCE_MS,
  snapToWordOrSentenceBoundary,
  snapToNearestScene,
  overlaps,
  deduplicateClips,
  mergeClipBoundaries,
} from './merger/index';
