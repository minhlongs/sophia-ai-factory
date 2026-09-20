/**
 * Customer Handover Domain Service
 * Layer: tree (Domain operations; imports only from @/seed and @/tree)
 *
 * Provides database queries and mutations for customer handovers, acceptance sign-offs,
 * and immutable certificate archival.
 *
 * @module tree/handover/customer-handover-service
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

/**
 * Retrieves a customer handover by ID or by customer_user_id.
 */
export async function getCustomerHandover(
  db: D1Database,
  identifier: string,
): Promise<CustomerHandoverRecord | null> {
  const cleanId = identifier.trim();
  try {
    const row = await db
      .prepare(
        `SELECT * FROM customer_handovers WHERE id = ?1 OR customer_user_id = ?1 LIMIT 1`,
      )
      .bind(cleanId)
      .first<CustomerHandoverRecord>();

    return row ?? null;
  } catch (err) {
    logger.error('[customer-handover-service] Failed to get handover', err instanceof Error ? err : undefined, { identifier: cleanId });
    return null;
  }
}

/**
 * Lists all customer handovers with optional status and pagination filters.
 */
export async function listAllCustomerHandovers(
  db: D1Database,
  filter?: {
    limit?: number;
    offset?: number;
    status?: string;
    acceptanceStatus?: string;
  },
): Promise<CustomerHandoverRecord[]> {
  const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 100);
  const offset = Math.max(filter?.offset ?? 0, 0);

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (filter?.status) {
    bindings.push(filter.status);
    conditions.push(`status = ?${bindings.length}`);
  }

  if (filter?.acceptanceStatus) {
    bindings.push(filter.acceptanceStatus);
    conditions.push(`acceptance_status = ?${bindings.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  bindings.push(limit);
  const limitIdx = bindings.length;
  bindings.push(offset);
  const offsetIdx = bindings.length;

  try {
    const query = `
      SELECT * FROM customer_handovers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?${limitIdx} OFFSET ?${offsetIdx}
    `;

    const stmt = db.prepare(query);
    const result = await stmt.bind(...bindings).all<CustomerHandoverRecord>();
    return result.results ?? [];
  } catch (err) {
    logger.error('[customer-handover-service] Failed to list handovers', err instanceof Error ? err : undefined);
    return [];
  }
}

/**
 * Calculates aggregate handover and acceptance statistics.
 */
export async function getHandoverStats(
  db: D1Database,
): Promise<{
  total: number;
  pending: number;
  active: number;
  accepted: number;
  rejected: number;
}> {
  try {
    const rows = await db
      .prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN acceptance_status = 'accepted' THEN 1 ELSE 0 END) as accepted,
          SUM(CASE WHEN acceptance_status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM customer_handovers
      `)
      .first<{
        total: number;
        pending: number;
        active: number;
        accepted: number;
        rejected: number;
      }>();

    return {
      total: Number(rows?.total ?? 0),
      pending: Number(rows?.pending ?? 0),
      active: Number(rows?.active ?? 0),
      accepted: Number(rows?.accepted ?? 0),
      rejected: Number(rows?.rejected ?? 0),
    };
  } catch (err) {
    logger.error('[customer-handover-service] Failed to get handover stats', err instanceof Error ? err : undefined);
    return { total: 0, pending: 0, active: 0, accepted: 0, rejected: 0 };
  }
}

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
  // We return the existing immutable certificate and record without updating
  // customer_handovers or overwriting handover_certificates.
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

    // Fallback: If handover is accepted but cert table row was not found, return synthesized immutable record without mutating DB
    logger.warn('[customer-handover-service] Handover already accepted; certificate row missing, reconstructing from immutable handover record', {
      handoverId: existing.id,
    });
    const fallbackCert: HandoverCertificate = {
      id: `cert_${existing.id.slice(0, 12)}_${existing.signed_at || existing.created_at}`,
      handoverId: existing.id,
      tenantId: existing.tenant_id,
      customerName: existing.agency_name,
      customerEmail: existing.signer_email || input.signerEmail.trim(),
      signerName: existing.signer_name || input.signerName.trim(),
      signerEmail: existing.signer_email || input.signerEmail.trim(),
      signerRole: existing.signer_role || input.signerRole.trim(),
      tier: existing.tier,
      deployedSha: (process.env.COMMIT_SHA || process.env.NEXT_PUBLIC_COMMIT_SHA || 'production-verified').slice(0, 12),
      certificateSha256: existing.certificate_hash || 'hash_already_accepted',
      verificationResults: existing.verification_results,
      contentMarkdown: '',
      metadataJson: existing.notes ? JSON.stringify({ notes: existing.notes }) : null,
      createdAt: existing.signed_at || existing.created_at,
    };
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
