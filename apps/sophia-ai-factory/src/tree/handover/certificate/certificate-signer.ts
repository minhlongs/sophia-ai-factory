/**
 * Handover Certificate Payload Construction & Hash Signer
 *
 * @module tree/handover/certificate/certificate-signer
 */

import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificatePayload,
} from '@/seed/handover/handover-types';
import { generateCertificateSha256 } from '@/seed/handover/certificate-hasher';
import { CANONICAL_ACCEPTANCE_STATEMENTS } from './types';

/**
 * Constructs canonical certificate payload for hashing.
 */
export function buildCertificatePayload(
  record: CustomerHandoverRecord,
  input: HandoverAcceptanceInput,
  deployedSha: string,
  timestamp: number = Date.now(),
): HandoverCertificatePayload {
  const statements = input.acceptanceStatements && input.acceptanceStatements.length > 0
    ? input.acceptanceStatements
    : CANONICAL_ACCEPTANCE_STATEMENTS;

  return {
    handoverId: record.id,
    tenantId: record.tenant_id,
    customerName: record.agency_name,
    customerEmail: input.signerEmail,
    signerName: input.signerName,
    signerEmail: input.signerEmail,
    signerRole: input.signerRole,
    tier: record.tier,
    deployedSha: deployedSha.trim() || 'production-verified',
    timestamp,
    acceptanceCheckpoints: statements,
  };
}

/**
 * Computes the SHA-256 hash for a given record and acceptance input.
 */
export async function computeHandoverCertificateHash(
  record: CustomerHandoverRecord,
  input: HandoverAcceptanceInput,
  deployedSha: string,
  timestamp: number = Date.now(),
): Promise<string> {
  const payload = buildCertificatePayload(record, input, deployedSha, timestamp);
  return await generateCertificateSha256(payload);
}
