/**
 * Claim extraction with risk levels and source normalization.
 * Ported from Lumen's script-writer normalizeAIClaims.
 */

export interface ExtractedClaim {
  readonly text: string;
  readonly riskLevel: 'standard' | 'high';
  readonly sourceUrls: readonly string[];
}

export interface ClaimSource {
  readonly url: string;
}

/**
 * Normalize raw AI-generated claims into structured ExtractedClaims.
 * Filters to allowed source URLs, caps at 25 claims, normalizes risk levels.
 */
export function extractClaims(
  rawClaims: readonly Record<string, unknown>[],
  allowedSources: readonly ClaimSource[],
): ExtractedClaim[] {
  const allowedUrls = new Set(allowedSources.map((s) => s.url));

  return rawClaims
    .slice(0, 25)
    .map((item) => {
      const text = String(item?.text ?? item?.claim ?? '').trim().slice(0, 1000);
      const riskLevel: 'standard' | 'high' =
        item?.riskLevel === 'high' ? 'high' : 'standard';
      const sourceUrls = dedupeStrings(
        (Array.isArray(item?.sourceUrls) ? item.sourceUrls : [])
          .map((url) => String(url))
          .filter((url) => allowedUrls.has(url)),
      );
      return { text, riskLevel, sourceUrls };
    })
    .filter((claim) => claim.text.length > 0);
}

/**
 * Extract verifiable claims from plain text content.
 * Identifies sentences containing statistical or factual assertions.
 */
export function extractVerifiableClaims(content: string): string[] {
  const statPatterns = [
    /\d+(\.\d+)?%/,
    /\d{4}/,
    /\$\d+/,
    /\d+x\b/i,
    /billion|million|thousand/i,
    /study|research|survey|report/i,
  ];

  return content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && statPatterns.some((p) => p.test(s)));
}

/**
 * Assign risk levels to claims based on content analysis.
 */
export function assessClaimRisk(
  claim: string,
  hasSource: boolean,
): 'standard' | 'high' {
  const highRiskMarkers = [
    /\d+(\.\d+)?%/,
    /study shows/i,
    /research proves/i,
    /scientifically proven/i,
    /guaranteed/i,
  ];

  const isHighRisk = highRiskMarkers.some((p) => p.test(claim));
  if (isHighRisk && !hasSource) return 'high';
  return 'standard';
}

function dedupeStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}
