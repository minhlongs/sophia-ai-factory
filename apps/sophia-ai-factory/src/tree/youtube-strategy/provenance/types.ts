/**
 * Provenance types and contracts for YouTube content.
 */

export type SourceType = 'article' | 'video' | 'dataset' | 'official' | 'asset' | 'other';
export type SourceStatus = 'pending' | 'verified' | 'rejected';
export type ClaimRiskLevel = 'standard' | 'high';
export type ClaimStatus = 'pending' | 'supported' | 'unsupported' | 'waived';

export interface NormalizedSource {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly publishedAt: string | null;
  readonly accessedAt: string;
  readonly sourceType: SourceType;
  readonly status: SourceStatus;
  readonly notes: string;
}

export interface NormalizedClaim {
  readonly id: string;
  readonly text: string;
  readonly riskLevel: ClaimRiskLevel;
  readonly sourceIds: readonly string[];
  readonly status: ClaimStatus;
  readonly notes: string;
}

export interface ProvenanceRecord {
  readonly sources: readonly NormalizedSource[];
  readonly claims: readonly NormalizedClaim[];
  readonly containsSyntheticMedia: boolean;
  readonly status: 'not_required' | 'verified' | 'blocked';
  readonly reviewedAt: string | null;
  readonly summary: {
    readonly sourceCount: number;
    readonly verifiedSources: number;
    readonly claimCount: number;
    readonly resolvedClaims: number;
    readonly highRiskClaims: number;
    readonly unresolvedClaims: number;
  };
}

export interface ProvenanceInput {
  readonly sources?: readonly Record<string, unknown>[];
  readonly claims?: readonly Record<string, unknown>[];
  readonly containsSyntheticMedia?: boolean;
}
