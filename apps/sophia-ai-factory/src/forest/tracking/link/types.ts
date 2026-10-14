/**
 * Tracking Link Types
 *
 * Layer: forest/tracking
 */

export interface CreateLinkParams {
  tenantId: string;
  destinationUrl: string;
  affiliateId?: string;
  campaignId?: string;
}

export interface TrackingLink {
  id: string;
  tenantId: string;
  destinationUrl: string;
  affiliateId: string | null;
  campaignId: string | null;
  active: boolean;
  createdAt: string;
  /** Short URL for embedding in content */
  shortUrl: string;
}

export interface PostbackPayload {
  externalConversionId?: string;
  amountUsd?: number;
  [key: string]: unknown;
}
