/**
 * Publisher Interface — shared across all platform providers
 * Located in land/video/publishing/providers/
 *
 * This interface re-exports canonical types from seed to ensure cross-layer compatibility.
 */

// Re-export canonical types from seed
export type PublishMeta = import('@/seed/types/channel-provider').PublishMeta;
export type MetricsJson = import('@/seed/types/channel-provider').MetricsJson;
export type PublishStatus = import('@/seed/types/channel-provider').PublishStatus;

/**
 * Publisher interface for video publishing providers.
 * Implementations must be compatible with the canonical seed Publisher.
 */
export interface Publisher {
  /**
   * Upload and publish a video to the platform
   * @param videoUrl - Canonical URL of the video to upload
   * @param meta - Publication metadata (caption, hashtags, title, productLink)
   * @returns The platform-specific post ID
   */
  upload(videoUrl: string, meta: PublishMeta): Promise<string>;

  /**
   * Poll the publication status of a video
   * @param externalPostId - The platform-specific post ID
   * @returns The current publish status (scheduled|uploading|processing|live|failed)
   */
  pollStatus(externalPostId: string): Promise<PublishStatus>;

  /**
   * Get detailed metrics for a published video
   * @param postId - The platform-specific post ID
   * @returns Metrics data (views, likes, shares, comments, reach)
   */
  getMetrics(postId: string): Promise<MetricsJson>;

  /**
   * Delete a published video (optional)
   * @param postId - The platform-specific post ID
   */
  delete?(postId: string): Promise<void>;
}
