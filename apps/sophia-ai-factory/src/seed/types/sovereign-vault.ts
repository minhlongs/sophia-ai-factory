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

export interface ErasureCertificate {
  id: string;
  certificateNumber: string;
  orgId: string | null;
  subjectIdPseudonym: string;
  jurisdiction: RegulatoryFramework;
  legalBasis: string;
  erasureMethod: ErasureMethod;
  shreddedKeyFingerprint: string | null;
  affectedRecordsCount: number;
  recordsManifestHash: string;
  verifierPublicKeyId: string;
  digitalSignature: string;
  issuedAt: number;
  certificatePdfUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
}

/** Authenticated Additional Data bound to AES-GCM ciphertext to prevent tampering/splicing */
export interface EnvelopeAad {
  orgId: string;
  zoneCode: SovereignZoneCode;
  keyVersion: number;
  algorithm: 'AES-256-GCM';
  [key: string]: unknown;
}

/** Envelope encrypted ciphertext serialized representation */
export interface EnvelopeCiphertextPayload {
  header: 'cmek-v1';
  keyId: string;
  keyVersion: number;
  ivBase64: string;
  ciphertextBase64: string;
  aadCanonicalJson?: string;
}

export interface LegalHoldStatus {
  canErase: boolean;
  reason?: string;
  statutoryBasis?: string;
  holdExpiresAt?: number;
}

export interface ErasureManifestItem {
  recordId: string;
  tableOrCollection: string;
  shreddedAt: number;
  hash: string;
}

export interface ErasureRequestInput {
  subjectId: string;
  orgId?: string;
  jurisdiction: RegulatoryFramework;
  legalBasis?: string;
  erasureMethod?: ErasureMethod;
  actorId?: string;
  dryRun?: boolean;
}

export interface ErasureExecutionResult {
  success: boolean;
  certificateNumber?: string;
  certificate?: ErasureCertificate;
  affectedRecordsCount: number;
  shreddedKeysCount: number;
  legalHoldBlocked?: boolean;
  reason?: string;
  errors?: string[];
}

export interface ChainVerificationResult {
  isValid: boolean;
  checkedCount: number;
  genesisHash?: string;
  latestHash?: string;
  tamperedEventId?: string;
  tamperedIndex?: number;
  error?: string;
}

export interface CrossBorderValidationResult {
  allowed: boolean;
  sourceZone: SovereignZoneCode;
  targetZone: SovereignZoneCode;
  verdict: PolicyVerdict;
  reason: string;
}
