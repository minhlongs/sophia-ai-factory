/**
 * Pure Domain Algorithm: Affiliate Conversion Matcher
 * Parses and matches external affiliate conversions with internal video manifests.
 * Layer: tree/growth-v12 | Max LOC: < 200 | Zero :any
 * @module tree/growth-v12/affiliate-matcher
 */

import type { AffiliateConversionWebhook } from '@/seed/types/growth-triad-v12';

export interface AttributionMatchResult {
  isMatched: boolean;
  videoManifestId: string;
  externalOrderId: string;
  affiliateNetwork: string;
  grossAmountUsd: number;
  commissionAmountUsd: number;
  confidenceScore: number;
  notes?: string;
}

export interface MatchCandidateManifest {
  manifestId: string;
  channelId: string;
  trackingSubId?: string;
  utmCampaign?: string;
}

/**
 * Extracts and normalizes affiliate conversion metadata into a verified attribution record.
 */
export function matchConversionToManifest(
  conversion: AffiliateConversionWebhook,
  candidates: MatchCandidateManifest[],
): AttributionMatchResult {
  const cleanSubId = conversion.subId?.trim().toLowerCase();
  const cleanExtOrder = conversion.externalOrderId.trim();

  // 1. Direct subId / manifestId exact match
  if (cleanSubId) {
    const exactMatch = candidates.find(
      (c) => c.manifestId.toLowerCase() === cleanSubId || c.trackingSubId?.toLowerCase() === cleanSubId,
    );

    if (exactMatch) {
      return {
        isMatched: true,
        videoManifestId: exactMatch.manifestId,
        externalOrderId: cleanExtOrder,
        affiliateNetwork: conversion.affiliateNetwork,
        grossAmountUsd: Math.max(conversion.grossAmountUsd, 0),
        commissionAmountUsd: Math.max(conversion.commissionAmountUsd, 0),
        confidenceScore: 1.0,
      };
    }
  }

  // 2. Fallback heuristic: matching via external payload custom tracking parameter
  if (conversion.rawPayload) {
    try {
      const parsed = JSON.parse(conversion.rawPayload) as Record<string, unknown>;
      const embeddedId = (parsed.manifest_id || parsed.tracking_id || parsed.utm_id) as string | undefined;

      if (embeddedId && typeof embeddedId === 'string') {
        const found = candidates.find((c) => c.manifestId === embeddedId);
        if (found) {
          return {
            isMatched: true,
            videoManifestId: found.manifestId,
            externalOrderId: cleanExtOrder,
            affiliateNetwork: conversion.affiliateNetwork,
            grossAmountUsd: conversion.grossAmountUsd,
            commissionAmountUsd: conversion.commissionAmountUsd,
            confidenceScore: 0.85,
            notes: 'Matched via embedded rawPayload tracking parameter',
          };
        }
      }
    } catch {
      // Ignore parse errors in pure algorithmic matcher
    }
  }

  return {
    isMatched: false,
    videoManifestId: '',
    externalOrderId: cleanExtOrder,
    affiliateNetwork: conversion.affiliateNetwork,
    grossAmountUsd: conversion.grossAmountUsd,
    commissionAmountUsd: conversion.commissionAmountUsd,
    confidenceScore: 0,
    notes: 'No matching candidate manifest found for subId or payload',
  };
}
