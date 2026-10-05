/**
 * Backward compatibility facade for video publishing scheduling.
 * Canonical implementation lives in '@/land/video/publishing/video-publishing.service'.
 *
 * @module land/publish/schedule-video-publish
 */
import {
  scheduleVideoPublish,
  PublishConfigurationError,
  type SchedulePublishInput,
  type SchedulePublishResult,
} from '@/land/video/publishing/video-publishing.service';

export {
  PublishConfigurationError,
  type SchedulePublishInput,
  type SchedulePublishResult,
};

export async function schedulePublish(
  input: SchedulePublishInput,
): Promise<SchedulePublishResult> {
  return scheduleVideoPublish(input);
}
