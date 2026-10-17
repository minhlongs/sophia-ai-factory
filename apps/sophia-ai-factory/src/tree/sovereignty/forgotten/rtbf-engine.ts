import type { D1Database } from '@cloudflare/workers-types';
import type {
  ErasureRequestInput,
  ErasureExecutionResult,
  ExecuteRtbfOptions,
} from './types';
import { appendComplianceAuditLog } from '../compliance-ledger';
import {
  sha256Hex,
  computeMerkleRoot,
  generateSubjectPseudonym,
  checkLegalHold,
  shredCustomerKeys,
  redactUserProfileRecord,
} from './cascading-purger';
import { persistErasureCertificate } from './tombstone-writer';
import {
  buildSignedErasureCertificate,
  verifyErasureCertificate,
} from './rtbf-certificate';

// Re-export helpers for backwards compatibility
export {
  sha256Hex,
  computeMerkleRoot,
  generateSubjectPseudonym,
  checkLegalHold,
  verifyErasureCertificate,
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
  const certificate = await buildSignedErasureCertificate({
    input,
    pseudonym,
    recordsManifestHash,
    affectedRecordsCount: affectedRecordIds.length,
    shreddedCount,
    fingerprint,
    now,
    signingKey,
  });

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
    resourceId: certificate.certificateNumber,
    jurisdictionCompliance: input.jurisdiction,
    policyVerdict: 'ENFORCED',
    payload: {
      certificateNumber: certificate.certificateNumber,
      subjectPseudonym: pseudonym,
      recordsManifestHash,
      affectedRecordsCount: affectedRecordIds.length,
      shreddedKeysCount: shreddedCount,
    },
    signingKeySecret: signingKey,
  });

  return {
    success: true,
    certificateNumber: certificate.certificateNumber,
    certificate,
    affectedRecordsCount: affectedRecordIds.length,
    shreddedKeysCount: shreddedCount,
  };
}
