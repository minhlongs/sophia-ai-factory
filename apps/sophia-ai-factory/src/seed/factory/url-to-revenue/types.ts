/**
 * URL-to-Revenue Domain Types
 *
 * Layer: seed/factory
 */

export type JobStatus =
  | 'queued'
  | 'scripting'
  | 'rendering'
  | 'publishing'
  | 'completed'
  | 'failed';

export type Channel = 'youtube' | 'tiktok' | 'instagram';

export interface URLToRevenueRequest {
  /** Affiliate landing page URL — must be HTTPS */
  url: string;
  tenantId: string;
  channels: Channel[];
  /** Number of variants per locale (default 3, max 5 per YAGNI) */
  variants?: number;
  /** Locales to generate (default ['vi', 'en']) */
  locales?: string[];
  /** Tracking link ID from edge tracking (optional) */
  trackingId?: string;
}

export interface URLToRevenueVariant {
  locale: string;
  channel: Channel;
  videoJobId?: string;
  publishedUrl?: string;
  error?: string;
}

export interface URLToRevenueResult {
  jobId: string;
  status: JobStatus;
  variants: URLToRevenueVariant[];
}
