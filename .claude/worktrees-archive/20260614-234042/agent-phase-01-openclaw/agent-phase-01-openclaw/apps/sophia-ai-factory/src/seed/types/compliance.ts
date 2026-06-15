/**
 * Compliance Metadata Types
 *
 * Types for AI disclosure, C2PA provenance metadata, platform TOS checks,
 * copyright verification, and age restriction compliance records.
 *
 * @module seed/types/compliance
 */

export type ComplianceType =
  | 'ai_disclosure'
  | 'c2pa_metadata'
  | 'platform_tos_check'
  | 'copyright_check'
  | 'age_restriction';

export type Platform =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'other';

/** Persisted compliance record (camelCase domain view). */
export interface ComplianceRecord {
  id: string;
  executionId: string;
  contentId?: string;
  userId: string;
  complianceType: ComplianceType;
  metadata: Record<string, unknown>;
  platform?: Platform;
  verified: boolean;
  verifiedAt?: number;
  createdAt: number;
}

/** C2PA content provenance metadata. */
export interface C2PAMetadata {
  generator: string;
  model: string;
  timestamp: string;
  inputSources: string[];
  modifications: string[];
}

/** AI-generated content disclosure. */
export interface AIDisclosure {
  isAiGenerated: boolean;
  aiModelsUsed: string[];
  humanOversight: boolean;
  disclosureText: string;
}

/** Aggregated compliance summary for a user. */
export interface ComplianceReport {
  userId: string;
  totalRecords: number;
  verifiedCount: number;
  unverifiedCount: number;
  byType: Record<ComplianceType, number>;
  byPlatform: Record<string, number>;
}
