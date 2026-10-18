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
import { getCustomerHandover } from './migration-verifier';
import { upsertHandoverCertificate } from './credential-packager';
import {
  buildAcceptanceCertificate,
  resolveDeployedSha,
  resolveExistingAcceptedHandover,
} from './handover-acceptance-helpers';

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
    return resolveExistingAcceptedHandover(db, existing, input);
  }

  const deployedSha = resolveDeployedSha();
  const nowMs = Date.now();

  const {
    certData,
    certificateHash,
    verificationJson,
    verificationPassedAt,
  } = await buildAcceptanceCertificate({
    existing,
    input,
    deployedSha,
    nowMs,
    verificationReport,
  });

  // Atomically update customer_handovers in D1
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

  await upsertHandoverCertificate(db, certData);

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
