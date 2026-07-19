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
export type ChannelProvider = import('@/seed/types/channel-provider').ChannelProvider;

/**
 * Publisher interface for video publishing providers.
 * Implementations must be compatible with the canonical seed Publisher.
 */
export interface Publisher {
	/**
	 * Upload and publish a video to the platform
	 * @param videoUrl - Canonical URL of the video to upload
	 * @param meta - Publishing metadata (caption, hashtags, etc.)
	 * @returns Publish result with external post ID and status
	 */
	publish(
		videoUrl: string,
		meta: PublishMeta,
	): Promise<PublishResult>;

	/**
	 * Check publishing status of an existing post
	 * @param externalPostId - Platform-specific post ID
	 * @returns Current publish status
	 */
	getStatus(externalPostId: string): Promise<PublishStatus>;

	/**
	 * Get engagement metrics for a published post
	 * @param externalPostId - Platform-specific post ID
	 * @returns Metrics JSON (views, likes, shares, etc.)
	 */
	getMetrics(externalPostId: string): Promise<MetricsJson>;
}

export interface PublishResult {
	success: boolean;
	externalPostId?: string;
	error?: string;
	platformUrl?: string;
}
