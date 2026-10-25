/**
 * Image job status vocabulary shared by the workspace UI and its tests.
 *
 * Raw statuses come from `media_jobs.status`, which is written by the MuAPI
 * poller and the synchronous fal.ai path. Anything outside the known set is
 * surfaced as `unknown` rather than guessed at, so an unrecognized provider
 * state can never read as a completed artifact.
 *
 * @module tree/creative-studio/image-job-status
 */

/** Statuses the backend actually writes. */
export type ImageJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'unknown';

/** Presentation group the workspace UI dispatches on. */
export type ImageJobStage = 'queued' | 'running' | 'done' | 'failed' | 'unknown';

const KNOWN: readonly ImageJobStatus[] = ['pending', 'processing', 'completed', 'failed'];

/** Narrow a raw DB status to the known vocabulary. */
export function normalizeImageJobStatus(raw: string | null | undefined): ImageJobStatus {
  return KNOWN.includes(raw as ImageJobStatus) ? (raw as ImageJobStatus) : 'unknown';
}

/** Map a status to the workspace stage used for copy, ordering and styling. */
export function imageJobStage(status: ImageJobStatus): ImageJobStage {
  switch (status) {
    case 'pending':
      return 'queued';
    case 'processing':
      return 'running';
    case 'completed':
      return 'done';
    case 'unknown':
      // A provider state we do not recognise is not a failure. Collapsing it
      // into 'failed' would tell the customer their generation broke when the
      // truth is that the vocabulary has no word for what the provider said.
      return 'unknown';
    default:
      return 'failed';
  }
}

/**
 * Jobs worth showing in the history strip with a state, newest first.
 * Failed jobs are kept: hiding them would let a new failure silently
 * overwrite an earlier success in the user's mental model.
 */
export interface ImageJobView {
  id: string;
  status: ImageJobStatus;
  stage: ImageJobStage;
  prompt: string;
  model: string;
  resultUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: number;
  completedAt: number | null;
}
