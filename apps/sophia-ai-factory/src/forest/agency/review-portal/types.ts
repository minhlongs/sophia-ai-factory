/**
 * Client Video Review Portal Types & Formatting
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/types
 */

import type { VideoReviewPayload, FeedbackComment } from '@/seed/types/agency-multitenancy';

export type ReviewPortalBranding = VideoReviewPayload['subaccountBranding'];

export interface ClientVideoReviewPortalProps {
  review: VideoReviewPayload;
  locale?: 'en' | 'vi';
  onFeedbackSubmit?: (comment: FeedbackComment) => Promise<void>;
  onDecisionSubmit?: (decision: 'approve' | 'request_changes', note?: string) => Promise<void>;
}

export type ReviewDecisionType = 'approve' | 'request_changes';

export function formatTime(seconds?: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
