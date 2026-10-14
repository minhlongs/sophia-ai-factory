/**
 * Sovereign Data Residency & Cryptographic Compliance Vault Types
 *
 * Defines the canonical types for Pillar 1 of Milestone $800k MRR:
 * - Sovereign Data Zones & Regional Jurisdiction Policies
 * - Customer-Managed Encryption Keys (CMEK) & Envelope Encryption
 * - Cryptographic Hash-Chain Audit Logging
 * - Right-to-be-Forgotten & Cryptographic Certificates of Erasure
 *
 * Layer: seed/types (Foundational, Zero upward dependencies)
 *
 * @module seed/types/sovereign-vault
 */

export type SovereignZoneCode = 'EU' | 'VN' | 'APAC_SG' | 'APAC_JP' | 'US' | 'GLOBAL';

export type RegulatoryFramework =
  | 'EU_GDPR'
  | 'VN_PDPD'
  | 'SG_PDPA'
  | 'JP_APPI'
  | 'US_CCPA'
  | 'MULTI_JURISDICTION';

export type CrossBorderTransferPolicy =
  | 'strictly_prohibited'
  | 'adequacy_only'
  | 'explicit_consent_scc'
  | 'unrestricted';

export type KeyState = 'active' | 'suspended' | 'revoked' | 'compromised' | 'destroyed';

export type KeyType =
  | 'platform_managed_isolated'
  | 'cmek_byok_raw'
  | 'cmek_aws_kms'
  | 'cmek_gcp_kms'
  | 'cmek_vault';

export type ErasureMethod =
  | 'crypto_shredding'
  | 'physical_overwrite'
  | 'anonymization_and_redaction'
  | 'hybrid_shred_and_redact';

export type PolicyVerdict = 'ALLOWED' | 'DENIED' | 'AUDITED' | 'ENFORCED';

export type ActorType = 'user' | 'api_key' | 'system' | 'external_auditor';

export interface SovereignDataZone {
  id: string;
  zoneCode: SovereignZoneCode;
  name: string;
  jurisdictionLegalName: string;
  regulatoryFramework: RegulatoryFramework;
  primaryStorageRegion: string;
  fallbackStorageRegion: string | null;
  crossBorderTransferPolicy: CrossBorderTransferPolicy;
  mandatoryCmek: boolean;
  retentionPeriodDays: number;
  auditRetentionDays: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TenantSovereignKey {
  id: string;
  orgId: string;
  zoneId: string;
  keyAlias: string;
  keyType: KeyType;
  algorithm: string;
  keyVersion: number;
  wrappedDekCiphertext: string;
  dekIvBase64: string;
  kekReferenceOrFingerprint: string;
  keyState: KeyState;
  rotationIntervalDays: number;
  lastRotatedAt: number | null;
  nextRotationDueAt: number | null;
  revokedAt: number | null;
  revocationReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ComplianceAuditLog {
  id: string;
  orgId: string | null;
  zoneId: string;
  actorId: string;
  actorType: ActorType;
  actorIpHash: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  jurisdictionCompliance: RegulatoryFramework | 'GLOBAL';
  policyVerdict: PolicyVerdict;
  payload: Record<string, unknown>;
  prevHash: string | null;
  contentHash: string;
  digitalSignature: string | null;
  timestamp: number;
  createdAt: number;
}

export type {
  ErasureCertificate,
  EnvelopeAad,
  EnvelopeCiphertextPayload,
  LegalHoldStatus,
  ErasureManifestItem,
  ErasureRequestInput,
  ErasureExecutionResult,
  ChainVerificationResult,
  CrossBorderValidationResult,
} from './sovereign-vault-erasure-types';
