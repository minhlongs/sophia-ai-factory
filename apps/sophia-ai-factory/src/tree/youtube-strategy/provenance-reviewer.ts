/**
 * Provenance review system for YouTube content.
 * Source normalization, claim validation, and review workflow.
 * Ported from Lumen's provenance-service.
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

const SOURCE_TYPES = new Set<string>(['article', 'video', 'dataset', 'official', 'asset', 'other']);
const SOURCE_STATUSES = new Set<string>(['pending', 'verified', 'rejected']);
const CLAIM_RISKS = new Set<string>(['standard', 'high']);
const CLAIM_STATUSES = new Set<string>(['pending', 'supported', 'unsupported', 'waived']);

const MAX_SOURCES = 50;
const MAX_CLAIMS = 100;

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

function normalizeSources(items: readonly Record<string, unknown>[]): NormalizedSource[] {
  const seenUrls = new Set<string>();
  return items.slice(0, MAX_SOURCES).map((item, index) => {
    const url = validUrl(item?.url);
    if (!url) throw new Error(`Source ${index + 1} requires a valid http or https URL`);
    if (seenUrls.has(url)) throw new Error(`Duplicate source URL: ${url}`);
    seenUrls.add(url);
    return {
      id: normalizeId(item?.id, 'source'),
      url,
      title: textValue(item?.title, 300) || url,
      publisher: textValue(item?.publisher, 200),
      publishedAt: date(item?.publishedAt),
      accessedAt: date(item?.accessedAt) ?? new Date().toISOString(),
      sourceType: SOURCE_TYPES.has(item?.sourceType as string) ? item.sourceType as SourceType : 'other',
      status: SOURCE_STATUSES.has(item?.status as string) ? item.status as SourceStatus : 'pending',
      notes: textValue(item?.notes, 1000),
    };
  });
}

function normalizeClaims(
  items: readonly Record<string, unknown>[],
  sources: readonly NormalizedSource[],
): NormalizedClaim[] {
  const validSourceIds = new Set(sources.map((s) => s.id));
  return items.slice(0, MAX_CLAIMS).map((item, index) => {
    const claimText = textValue(item?.text ?? item?.claim, 1000);
    if (!claimText) throw new Error(`Claim ${index + 1} requires text`);
    const sourceIds = dedupeStrings(
      [
        ...(Array.isArray(item?.sourceIds) ? item.sourceIds : []),
        ...(Array.isArray(item?.sourceUrls)
          ? item.sourceUrls.map((u) => urlToId(u, sources))
          : []),
      ]
        .map((v) => String(v))
        .filter((id) => validSourceIds.has(id)),
    );
    return {
      id: normalizeId(item?.id, 'claim'),
      text: claimText,
      riskLevel: CLAIM_RISKS.has(item?.riskLevel as string) ? item.riskLevel as ClaimRiskLevel : 'standard',
      sourceIds,
      status: CLAIM_STATUSES.has(item?.status as string) ? item.status as ClaimStatus : 'pending',
      notes: textValue(item?.notes, 1000),
    };
  });
}

function normalizeId(value: unknown, prefix: string): string {
  const normalized = String(value ?? '').trim();
  if (/^[a-zA-Z0-9_-]{1,100}$/.test(normalized)) return normalized;
  return `${prefix}_${generateUuid()}`;
}

function validUrl(value: unknown): string {
  try {
    const url = new URL(String(value ?? '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function urlToId(url: unknown, sources: readonly NormalizedSource[]): string {
  const valid = validUrl(url);
  if (!valid) return '';
  const match = sources.find((s) => s.url === valid);
  return match?.id ?? '';
}

function textValue(value: unknown, limit: number): string {
  return String(value ?? '').trim().slice(0, limit);
}

function date(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function dedupeStrings(arr: string[]): string[] {
  return [...new Set(arr)];
}

function generateUuid(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}