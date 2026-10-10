import type { D1Database } from '@cloudflare/workers-types';
import type { ErasureCertificate, RegulatoryFramework, ErasureMethod } from './types';

/**
 * Persists an issued Erasure Certificate into D1 database.
 */
export async function persistErasureCertificate(
  db: D1Database,
  cert: ErasureCertificate,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO erasure_certificates (
        id, certificate_number, org_id, subject_id_pseudonym,
        jurisdiction, legal_basis, erasure_method, shredded_key_fingerprint,
        affected_records_count, records_manifest_hash, verifier_public_key_id,
        digital_signature, issued_at, metadata_json, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
    `)
    .bind(
      cert.id,
      cert.certificateNumber,
      cert.orgId ?? null,
      cert.subjectIdPseudonym,
      cert.jurisdiction,
      cert.legalBasis,
      cert.erasureMethod,
      cert.shreddedKeyFingerprint,
      cert.affectedRecordsCount,
      cert.recordsManifestHash,
      cert.verifierPublicKeyId,
      cert.digitalSignature,
      cert.issuedAt,
      JSON.stringify(cert.metadata),
      cert.createdAt,
    )
    .run();
}

/**
 * Fetches an erasure certificate by certificate number and returns the typed record.
 */
export async function getErasureCertificateByNumber(
  db: D1Database,
  certificateNumber: string,
): Promise<ErasureCertificate | null> {
  const row = await db
    .prepare('SELECT * FROM erasure_certificates WHERE certificate_number = ?1 LIMIT 1')
    .bind(certificateNumber)
    .first<Record<string, unknown>>();

  if (!row) return null;

  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(String(row.metadata_json || '{}'));
  } catch {
    metadata = {};
  }

  return {
    id: String(row.id),
    certificateNumber: String(row.certificate_number),
    orgId: row.org_id ? String(row.org_id) : null,
    subjectIdPseudonym: String(row.subject_id_pseudonym),
    jurisdiction: row.jurisdiction as RegulatoryFramework,
    legalBasis: String(row.legal_basis),
    erasureMethod: row.erasure_method as ErasureMethod,
    shreddedKeyFingerprint: row.shredded_key_fingerprint ? String(row.shredded_key_fingerprint) : null,
    affectedRecordsCount: Number(row.affected_records_count || 0),
    recordsManifestHash: String(row.records_manifest_hash),
    verifierPublicKeyId: String(row.verifier_public_key_id),
    digitalSignature: String(row.digital_signature),
    issuedAt: Number(row.issued_at),
    certificatePdfUrl: row.certificate_pdf_url ? String(row.certificate_pdf_url) : null,
    metadata,
    createdAt: Number(row.created_at),
  };
}
