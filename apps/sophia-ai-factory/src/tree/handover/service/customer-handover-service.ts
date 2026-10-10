/**
 * customer-handover-service.ts — Tree Layer
 * Customer handover acceptance workflow coordinator
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
  VerificationRunReport,
} from '@/seed/handover/handover-types';
import {
  computeHandoverCertificateHash,
  generateCertificateMarkdown,
} from '@/tree/handover/handover-certificate-engine';
import { getCustomerHandover } from './migration-verifier';
import {
  getHandoverCertificate,
  upsertHandoverCertificate,
  createFallbackCertificate,
} from './credential-packager';

/**
 * Records customer digital acceptance sign-off, hashes the certificate,
 * archives the certificate record in D1, and updates the customer handover state.
 */
export async function recordHandoverAcceptance(
  db: D1Database,
  input: HandoverAcceptanceInput,
  verificationReport?: VerificationRunReport,
): Promise<{ certificate: HandoverCertificate; record: CustomerHandoverRecord }> {
  const cleanHandoverId = input.handoverId.trim();
  const existing = await getCustomerHandover(db, cleanHandoverId);
  if (!existing) {
    throw new Error(`Customer handover not found for ID: ${cleanHandoverId}`);
  }

  // IMMUTABILITY & IDEMPOTENCY GUARD:
  // If the handover has already been accepted, re-signing is prohibited.
  if (existing.acceptance_status === 'accepted') {
    const existingCert = await getHandoverCertificate(db, existing.id);
    if (existingCert) {
      logger.warn('[customer-handover-service] Handover already accepted; returning existing immutable certificate', {
        handoverId: existing.id,
        certificateHash: existingCert.certificateSha256,
        signedAt: existing.signed_at,
      });
      return { certificate: existingCert, record: existing };
    }

    logger.warn('[customer-handover-service] Handover already accepted; certificate row missing, reconstructing from immutable handover record', {
      handoverId: existing.id,
    });
    const deployedSha = (process.env.COMMIT_SHA || process.env.NEXT_PUBLIC_COMMIT_SHA || 'production-verified').slice(0, 12);
    const fallbackCert = createFallbackCertificate(existing, input, deployedSha);
    return { certificate: fallbackCert, record: existing };
  }

  const deployedSha = (process.env.COMMIT_SHA || process.env.NEXT_PUBLIC_COMMIT_SHA || 'production-verified').slice(0, 12);
  const nowMs = Date.now();

  // 1. Calculate cryptographic SHA-256 certificate digest
  const certificateHash = await computeHandoverCertificateHash(
    existing,
    input,
    deployedSha,
    nowMs,
  );

  const verificationJson = verificationReport ? JSON.stringify(verificationReport) : existing.verification_results;
  const verificationPassedAt = verificationReport?.overallVerdict === 'PASS' ? nowMs : existing.verification_passed_at;

  // 2. Generate Markdown certificate
  const certId = `cert_${existing.id.slice(0, 12)}_${nowMs}`;
  const certData: HandoverCertificate = {
    id: certId,
    handoverId: existing.id,
    tenantId: existing.tenant_id,
    customerName: existing.agency_name,
    customerEmail: input.signerEmail,
    signerName: input.signerName,
    signerEmail: input.signerEmail,
    signerRole: input.signerRole,
    tier: existing.tier,
    deployedSha,
    certificateSha256: certificateHash,
    verificationResults: verificationJson,
    contentMarkdown: '',
    metadataJson: JSON.stringify({
      notes: input.notes ?? null,
      acceptanceStatements: input.acceptanceStatements ?? null,
      verificationReportId: verificationReport?.runId ?? null,
    }),
    createdAt: nowMs,
  };

  certData.contentMarkdown = generateCertificateMarkdown(certData, verificationReport);

  // 3. Atomically update customer_handovers in D1
  await db
    .prepare(`
      UPDATE customer_handovers
      SET
        acceptance_status = 'accepted',
        signer_name = ?1,
        signer_email = ?2,
        signer_role = ?3,
        certificate_hash = ?4,
        verification_results = COALESCE(?5, verification_results),
        signed_at = ?6,
        verification_passed_at = COALESCE(?7, verification_passed_at),
        notes = ?8
      WHERE id = ?9
    `)
    .bind(
      input.signerName,
      input.signerEmail,
      input.signerRole,
      certificateHash,
      verificationJson,
      nowMs,
      verificationPassedAt,
      input.notes ?? null,
      existing.id,
    )
    .run();

  // 4. Upsert into handover_certificates table
  await upsertHandoverCertificate(db, certData);

  // 5. Reload updated record
  const updatedRecord = await getCustomerHandover(db, existing.id);
  if (!updatedRecord) {
    throw new Error(`Failed to reload updated customer handover record`);
  }

  logger.info('[customer-handover-service] Acceptance recorded successfully', {
    handoverId: existing.id,
    certificateHash,
    signerName: input.signerName,
  });

  return {
    certificate: certData,
    record: updatedRecord,
  };
}
