/**
 * handover-acceptance-helpers.ts — Tree Layer
 * Certificate construction and idempotency helpers for customer handover acceptance.
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
import {
  getHandoverCertificate,
  createFallbackCertificate,
} from './credential-packager';

export function resolveDeployedSha(): string {
  return (process.env.COMMIT_SHA || process.env.NEXT_PUBLIC_COMMIT_SHA || 'production-verified').slice(0, 12);
}

export async function resolveExistingAcceptedHandover(
  db: D1Database,
  existing: CustomerHandoverRecord,
  input: HandoverAcceptanceInput,
): Promise<{ certificate: HandoverCertificate; record: CustomerHandoverRecord }> {
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
  const deployedSha = resolveDeployedSha();
  const fallbackCert = createFallbackCertificate(existing, input, deployedSha);
  return { certificate: fallbackCert, record: existing };
}

export async function buildAcceptanceCertificate(params: {
  existing: CustomerHandoverRecord;
  input: HandoverAcceptanceInput;
  deployedSha: string;
  nowMs: number;
  verificationReport?: VerificationRunReport;
}): Promise<{
  certData: HandoverCertificate;
  certificateHash: string;
  verificationJson: string | null;
  verificationPassedAt: number | null;
}> {
  const { existing, input, deployedSha, nowMs, verificationReport } = params;
  const certificateHash = await computeHandoverCertificateHash(
    existing,
    input,
    deployedSha,
    nowMs,
  );

  const verificationJson = verificationReport
    ? JSON.stringify(verificationReport)
    : existing.verification_results;
  const verificationPassedAt =
    verificationReport?.overallVerdict === 'PASS' ? nowMs : existing.verification_passed_at;

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

  return {
    certData,
    certificateHash,
    verificationJson,
    verificationPassedAt,
  };
}
