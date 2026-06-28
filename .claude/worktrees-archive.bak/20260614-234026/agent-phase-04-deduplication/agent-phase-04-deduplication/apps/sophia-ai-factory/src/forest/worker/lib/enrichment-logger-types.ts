/**
 * Enrichment Logger Types
 *
 * Shared type definitions for enrichment audit logging.
 *
 * @module worker/enrichment-logger-types
 */

/** Enrichment decision log entry */
export interface EnrichmentLog {
  id: string;
  timestamp: number;
  licenseNonce: string;
  userId: string;
  tier: string;
  features: string[];
  quotaLimits: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
  };
  enrichmentSource: 'cache' | 'database' | 'fallback';
  cacheHit: boolean;
  processingTimeMs: number;
  environment: string;
  requestId?: string;
  userAgent?: string;
  ipHash?: string;
}
