/**
 * Conversion Attributor Types
 *
 * @module land/affiliates/conversion-attributor-types
 */

export interface AttributionResult {
  clickId: string;
  campaignId: string;
  userId: string;
  offerId: string;
}

/** Phase 09 extended result includes tenant context */
export interface NetworkAttributionResult {
  linkId: string;
  tenantId: string;
  offerId: string;
  userId: string;
}

export interface ClickRow {
  click_id: string;
  campaign_id: string;
  user_id: string;
  offer_id: string;
}

export interface LinkRow {
  id: string;
  tenant_id: string;
  offer_id: string;
  user_id: string;
}

/**
 * Safe lookup result — separates "not found" (null) from "DB error" (Result.failure).
 */
export interface AttributionLookupResult {
  /** The attribution data, or null if not found / invalid input */
  data: AttributionResult | null;
  /** Non-null only on DB failures — null means "not found" or invalid input */
  error: Error | null;
}
