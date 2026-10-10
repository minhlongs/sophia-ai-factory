/**
 * credential-packager.ts — Tree Layer
 * Handover certificate persistence, retrieval, and fallback synthesis
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
} from '@/seed/handover/handover-types';

/**
 * Retrieves the stored HandoverCertificate for a given handover ID.
 */
export async function getHandoverCertificate(
  db: D1Database,
  handoverId: string,
): Promise<HandoverCertificate | null> {
  const cleanId = handoverId.trim();
  try {
    const row = await db
      .prepare(`
        SELECT
          id, handover_id as handoverId, tenant_id as tenantId,
          customer_name as customerName, customer_email as customerEmail,
          signer_name as signerName, signer_email as signerEmail,
          signer_role as signerRole, tier, deployed_sha as deployedSha,
          certificate_sha256 as certificateSha256, verification_results as verificationResults,
          content_markdown as contentMarkdown, metadata_json as metadataJson,
          created_at as createdAt
        FROM handover_certificates
        WHERE handover_id = ?1 OR id = ?1
        LIMIT 1
      `)
      .bind(cleanId)
      .first<HandoverCertificate>();

    return row ?? null;
  } catch (err) {
    logger.error('[customer-handover-service] Failed to get handover certificate', err instanceof Error ? err : undefined, { handoverId: cleanId });
    return null;
  }
}

/**
 * Upserts a handover certificate into D1 database.
 */
export async function upsertHandoverCertificate(
  db: D1Database,
  certData: HandoverCertificate,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO handover_certificates (
        id, handover_id, tenant_id, customer_name, customer_email,
        signer_name, signer_email, signer_role, tier, deployed_sha,
        certificate_sha256, verification_results, content_markdown, metadata_json, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
      ON CONFLICT(handover_id) DO UPDATE SET
        signer_name = excluded.signer_name,
        signer_email = excluded.signer_email,
        signer_role = excluded.signer_role,
        deployed_sha = excluded.deployed_sha,
        certificate_sha256 = excluded.certificate_sha256,
        verification_results = excluded.verification_results,
        content_markdown = excluded.content_markdown,
        metadata_json = excluded.metadata_json,
        created_at = excluded.created_at
    `)
    .bind(
      certData.id,
      certData.handoverId,
      certData.tenantId,
      certData.customerName,
      certData.customerEmail,
      certData.signerName,
      certData.signerEmail,
      certData.signerRole,
      certData.tier,
      certData.deployedSha,
      certData.certificateSha256,
      certData.verificationResults,
      certData.contentMarkdown,
      certData.metadataJson,
      certData.createdAt,
    )
    .run();
}

/**
 * Synthesizes fallback certificate for previously accepted handovers missing cert row.
 */
export function createFallbackCertificate(
  existing: CustomerHandoverRecord,
  input: HandoverAcceptanceInput,
  deployedSha: string,
): HandoverCertificate {
  return {
    id: `cert_${existing.id.slice(0, 12)}_${existing.signed_at || existing.created_at}`,
    handoverId: existing.id,
    tenantId: existing.tenant_id,
    customerName: existing.agency_name,
    customerEmail: existing.signer_email || input.signerEmail.trim(),
    signerName: existing.signer_name || input.signerName.trim(),
    signerEmail: existing.signer_email || input.signerEmail.trim(),
    signerRole: existing.signer_role || input.signerRole.trim(),
    tier: existing.tier,
    deployedSha,
    certificateSha256: existing.certificate_hash || 'hash_already_accepted',
    verificationResults: existing.verification_results,
    contentMarkdown: '',
    metadataJson: existing.notes ? JSON.stringify({ notes: existing.notes }) : null,
    createdAt: existing.signed_at || existing.created_at,
  };
}
