/**
 * Video Service — Backward Compatibility Barrel
 *
 * This file re-exports from the split services in ../publishing/
 * External code can import from either location.
 *
 * @module land/video/video-service
 * @deprecated Use individual services from ../publishing/ for new code
 */

// Generation service
export {
  aiPromptPipelineConfigured,
  generateVideo,
} from '../publishing/video-generation.service';
export type { VideoGenerateInput, VideoGenerateResult } from '../publishing/video-generation.service';

// Status service
export {
  getVideoStatus,
  getProgressForStatus,
} from '../publishing/video-status.service';
export type { VideoStatusResult } from '../publishing/video-status.service';

// Publishing service
export {
  publishVideo,
  retryVideo,
} from '../publishing/video-publishing.service';
export type { VideoPublishInput, VideoPublishResult, VideoRetryResult } from '../publishing/video-publishing.service';

// Default export for existing code using videoService object pattern
import { generateVideo } from '../publishing/video-generation.service';
import { publishVideo } from '../publishing/video-publishing.service';
import { getVideoStatus } from '../publishing/video-status.service';
import { retryVideo } from '../publishing/video-publishing.service';
import { aiPromptPipelineConfigured } from '../publishing/video-generation.service';

// Note: getProgressForStatus is also available but not included in videoService object
// for backward compatibility (it was not in the original public API)

export const videoService = {
  generateVideo,
  publishVideo,
  getVideoStatus,
  retryVideo,
  aiPromptPipelineConfigured,
};
