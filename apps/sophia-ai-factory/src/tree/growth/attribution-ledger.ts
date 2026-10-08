import { Result, success, failure } from '@/seed/types/result';
import { calculateRoiMetrics } from './roi-calculator';

export interface AttributionRecord {
  videoId: string;
  conversionId: string;
  revenueCents: number;
  timestamp: number;
}

export interface VideoSpendRecord {
  videoId: string;
  spendCents: number;
}

/**
 * Pure domain function to record a conversion against a ledger state.
 */
export function recordConversion(
  currentLedger: AttributionRecord[],
  conversion: AttributionRecord
): Result<AttributionRecord[], Error> {
  if (!conversion.videoId) {
    return failure(new Error('Invalid conversion: missing videoId'));
  }
  if (!conversion.conversionId) {
    return failure(new Error('Invalid conversion: missing conversionId'));
  }
  if (conversion.revenueCents < 0) {
    return failure(new Error('Invalid conversion: revenue cannot be negative'));
  }
  
  // Prevent duplicate conversions
  if (currentLedger.some(r => r.conversionId === conversion.conversionId)) {
    return failure(new Error('Duplicate conversionId'));
  }

  return success([...currentLedger, conversion]);
}

/**
 * Pure function to map ledger history into a finalized LTV score for a specific video.
 */
export function getVideoLTVScore(
  ledger: AttributionRecord[],
  spendLog: VideoSpendRecord[],
  videoId: string
): Result<number, Error> {
  if (!videoId) {
    return failure(new Error('Missing videoId'));
  }

  const relatedSpendLogs = spendLog.filter(s => s.videoId === videoId);
  if (relatedSpendLogs.length === 0) {
    return failure(new Error('No spend records found for video'));
  }

  // Aggregate stats
  const totalSpend = relatedSpendLogs.reduce((sum, s) => sum + s.spendCents, 0);
  if (totalSpend < 0) {
    return failure(new Error('Total spend cannot be negative'));
  }

  const videoConversions = ledger.filter(r => r.videoId === videoId);
  const totalRevenue = videoConversions.reduce((sum, r) => sum + r.revenueCents, 0);

  const metrics = calculateRoiMetrics({
    spend: totalSpend,
    revenue: totalRevenue,
    conversions: videoConversions.length
  });

  return success(metrics.ltvScore);
}
