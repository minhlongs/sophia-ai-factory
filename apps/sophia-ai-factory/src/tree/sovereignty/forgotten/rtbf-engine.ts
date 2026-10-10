import type { D1Database } from '@cloudflare/workers-types';
import type {
  ErasureCertificate,
  ErasureRequestInput,
  ErasureExecutionResult,
  ErasureMethod,
  ExecuteRtbfOptions,
  VerifyCertificateResult,
} from './types';
import { DEFAULT_SIGNING_KEY_ID } from './types';
import { bytesToHex } from '../cmek-envelope-engine';
import { appendComplianceAuditLog, signContentHash, verifySignature } from '../compliance-ledger';
import {
  sha256Hex,
  computeMerkleRoot,
  generateSubjectPseudonym,
  checkLegalHold,
  shredCustomerKeys,
  redactUserProfileRecord,
} from './cascading-purger';
import { persistErasureCertificate } from './tombstone-writer';

// Re-export helpers for backwards compatibility
export {
  sha256Hex,
  computeMerkleRoot,
  generateSubjectPseudonym,
  checkLegalHold,
};

/**
 * Orchestrated Right-to-be-Forgotten Execution.
 */
export async function executeRightToBeForgotten(
  db: D1Database,
  input: ErasureRequestInput,
  options: ExecuteRtbfOptions = {},
): Promise<ErasureExecutionResult> {
  const actorId = options.actorId ?? input.actorId ?? 'system_compliance_worker';
  const signingKey = options.signingKeySecret ?? process.env.SOVEREIGN_COMPLIANCE_KEY ?? 'sophia_sov_vault_sec_master_2026';

  // 1. Legal Hold Evaluation Gate
  const legalHold = await checkLegalHold(db, input.subjectId, input.orgId);
  if (!legalHold.canErase) {
    await appendComplianceAuditLog(db, {
      orgId: input.orgId,
      zoneId: 'zone_global_default',
      actorId,
      actorType: 'system',
      actorIpHash: await sha256Hex('127.0.0.1'),
      action: 'SOVEREIGN_ERASURE_REQUEST_BLOCKED',
      resourceType: 'data_subject',
      resourceId: input.subjectId,
      jurisdictionCompliance: input.jurisdiction,
      policyVerdict: 'DENIED',
      payload: {
        reason: legalHold.reason,
        statutoryBasis: legalHold.statutoryBasis,
      },
      signingKeySecret: signingKey,
    });

    return {
      success: false,
      legalHoldBlocked: true,
      reason: legalHold.reason,
      affectedRecordsCount: 0,
      shreddedKeysCount: 0,
    };
  }

  // 2. Zero-Knowledge Crypto-Shredding of Customer CMEK Keys
  const { shreddedCount, fingerprint, keyRecordIds } = await shredCustomerKeys(db, input.orgId);

  // 3. Subject Pseudonymization & Redaction in Core Tables
  const now = Date.now();
  const pseudonym = await generateSubjectPseudonym(input.subjectId);
  const profileRecordIds = await redactUserProfileRecord(db, input.subjectId, now);

  const affectedRecordIds: string[] = [
    ...keyRecordIds,
    ...profileRecordIds,
    `subject:${input.subjectId}`,
  ];

  // 4. Merkle Root Manifest of Purged Record Identifiers
  const recordsManifestHash = await computeMerkleRoot(affectedRecordIds);

  // 5. Generate Signed Certificate of Erasure
  const randomSuffix = bytesToHex(new Uint8Array(4)).toUpperCase();
  const certNumber = `SOV-ERASURE-${now}-${randomSuffix}`;
  const certId = `ec_${bytesToHex(new Uint8Array(16))}`;

  const signatureData = `${certNumber}|${pseudonym}|${input.jurisdiction}|${recordsManifestHash}|${now}`;
  const digitalSignature = await signContentHash(signatureData, signingKey);

  const erasureMethod: ErasureMethod = input.erasureMethod ?? (shreddedCount > 0 ? 'hybrid_shred_and_redact' : 'anonymization_and_redaction');
  const legalBasis = input.legalBasis ?? (input.jurisdiction === 'EU_GDPR' ? 'GDPR Article 17(1)' : 'Vietnam PDPD Article 16');

  const certMetadata = {
    affectedRecordIdsCount: affectedRecordIds.length,
    shreddedKeysCount: shreddedCount,
    statutoryNotice: 'This digital certificate constitutes cryptographic non-repudiation proof of data erasure.',
  };

  const certificate: ErasureCertificate = {
    id: certId,
    certificateNumber: certNumber,
    orgId: input.orgId ?? null,
    subjectIdPseudonym: pseudonym,
    jurisdiction: input.jurisdiction,
    legalBasis,
    erasureMethod,
    shreddedKeyFingerprint: fingerprint,
    affectedRecordsCount: affectedRecordIds.length,
    recordsManifestHash,
    verifierPublicKeyId: DEFAULT_SIGNING_KEY_ID,
    digitalSignature,
    issuedAt: now,
    certificatePdfUrl: null,
    metadata: certMetadata,
    createdAt: now,
  };

  await persistErasureCertificate(db, certificate);

  // 6. Record Immutable Audit Event
  await appendComplianceAuditLog(db, {
    orgId: input.orgId,
    zoneId: 'zone_global_default',
    actorId,
    actorType: 'system',
    actorIpHash: await sha256Hex('127.0.0.1'),
    action: 'SOVEREIGN_ERASURE_CERTIFICATE_ISSUED',
    resourceType: 'erasure_certificate',
    resourceId: certNumber,
    jurisdictionCompliance: input.jurisdiction,
    policyVerdict: 'ENFORCED',
    payload: {
      certificateNumber: certNumber,
      subjectPseudonym: pseudonym,
      recordsManifestHash,
      affectedRecordsCount: affectedRecordIds.length,
      shreddedKeysCount: shreddedCount,
    },
    signingKeySecret: signingKey,
  });

  return {
    success: true,
    certificateNumber: certNumber,
    certificate,
    affectedRecordsCount: affectedRecordIds.length,
    shreddedKeysCount: shreddedCount,
  };
}

/**
 * Validates the cryptographic non-repudiation signature of an Erasure Certificate.
 */
export async function verifyErasureCertificate(
  certificate: ErasureCertificate,
  signingKeySecret: string,
): Promise<VerifyCertificateResult> {
  const signatureData = `${certificate.certificateNumber}|${certificate.subjectIdPseudonym}|${certificate.jurisdiction}|${certificate.recordsManifestHash}|${certificate.issuedAt}`;
  const isValid = await verifySignature(signatureData, certificate.digitalSignature, signingKeySecret);

  if (!isValid) {
    return {
      isValid: false,
      error: 'Digital signature mismatch: Certificate content or Merkle manifest has been altered.',
    };
  }

  return { isValid: true };
}
