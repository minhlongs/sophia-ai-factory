/**
 * Videos repository — typed CRUD for video fulfillment state machine.
 * Supports queue-first pattern: insert as 'queued' before HeyGen call,
 * then transition to 'processing' on success or record failure for retry.
 *
 * @module seed/db/repositories/videos-repo
 */

// Types
export type { VideoStatus, VideoRow, EnqueueVideoInput, InsertAiPromptVideoInput, InsertAiPromptVideoResult } from './videos-repo-types'

// Write operations (non-CAS)
export {
  enqueueVideo,
  markVideoCompletedSynthetic,
  markVideoProcessing,
  recordAttempt,
  markPermanentFailure,
  revokeAccessByPurchaseId,
  insertAiPromptVideo,
} from './videos-repo-writes'

// CAS (Compare-And-Swap) operations — concurrent-safe state transitions
export {
  recordAttemptCAS,
  markPermanentFailureCAS,
  recordWebhookAttemptCAS,
  markWebhookPermanentFailureCAS,
} from './videos-repo-cas'

// Read operations
export {
  findByHeygenJobId,
  findByPurchaseId,
  listQueuedForRetry,
} from './videos-repo-reads'
