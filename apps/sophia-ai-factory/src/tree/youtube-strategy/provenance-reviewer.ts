/**
 * Provenance review system for YouTube content.
 * Source normalization, claim validation, and review workflow.
 * Ported from Lumen's provenance-service.
 */

import type { ProvenanceInput, ProvenanceRecord } from './provenance/types';
import { normalizeSources, normalizeClaims } from './provenance/normalizer';

export * from './provenance/types';

/**
 * Build a provenance record from raw input.
 */
export function buildProvenance(input: ProvenanceInput = {}): ProvenanceRecord {
  const sources = normalizeSources(input.sources ?? []);
  const claims = normalizeClaims(input.claims ?? [], sources);

  for (const claim of claims) {
    if (claim.status === 'supported') {
      const hasVerifiedSource = claim.sourceIds.some((id) =>
        sources.some((s) => s.id === id && s.status === 'verified'),
      );
      if (!hasVerifiedSource) {
        throw new Error('A supported claim must link to at least one verified source');
      }
    }
    if (claim.status === 'waived' && !claim.notes) {
      throw new Error('A waived claim requires a reviewer note');
    }
  }

  const unresolvedClaims = claims.filter(
    (c) => !['supported', 'waived'].includes(c.status),
  );
  const status: ProvenanceRecord['status'] =
    claims.length === 0
      ? 'not_required'
      : unresolvedClaims.length === 0
        ? 'verified'
        : 'blocked';

  return {
    sources,
    claims,
    containsSyntheticMedia: input.containsSyntheticMedia === true,
    status,
    reviewedAt: status === 'verified' ? new Date().toISOString() : null,
    summary: {
      sourceCount: sources.length,
      verifiedSources: sources.filter((s) => s.status === 'verified').length,
      claimCount: claims.length,
      resolvedClaims: claims.length - unresolvedClaims.length,
      highRiskClaims: claims.filter((c) => c.riskLevel === 'high').length,
      unresolvedClaims: unresolvedClaims.length,
    },
  };
}
