/**
 * Sovereign Vault Erasure, Envelope Encryption, and Chain Verification Types.
 * @module seed/types/sovereign-vault-erasure-types
 */

import type {
  SovereignZoneCode,
  RegulatoryFramework,
  ErasureMethod,
  PolicyVerdict,
} from './sovereign-vault';

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
