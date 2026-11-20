/**
 * Real operator-verified BankEvidenceVerifier backed by protected bank artifacts.
 * Always marks OPERATOR_VERIFIED_BANK_RECORD (never BANK_API_VERIFIED).
 * Layer: land/payments/manual-pilot
 */

import type { D1Database } from '@cloudflare/workers-types';
import { z } from 'zod';
import { failure, success, type Result } from '@/seed/types/result';
import { computeAccountFingerprint, sha256BytesHex } from './manual-pilot-bank-artifact-intake';
import {
  ingestManualPilotEvidence,
} from './manual-pilot-evidence';
import type { BankEvidenceLevel, BankVerificationBasis, ManualPilotError } from './types';

export const OPERATOR_VERIFIED_BASIS: BankVerificationBasis = 'OPERATOR_VERIFIED_BANK_RECORD';
export const DEFAULT_CHECK_MAX_STALENESS_MS = 24 * 60 * 60 * 1000;

export const operatorBankCheckSchema = z.object({
  approved: z.literal(true),
  accountIdentity: z.string().trim().min(1).max(128),
  artifactId: z.string().trim().min(5).max(128),
  orderId: z.string().trim().min(3).max(128),
  orgId: z.string().trim().min(1).max(128),
  direction: z.enum(['inbound', 'outbound']),
  inspectionSource: z.enum(['authenticated_bank_portal', 'official_bank_statement']),
  bankIdentity: z.string().trim().min(2).max(128),
  originalBankTxnId: z.string().trim().min(3).max(128),
  amountVnd: z.number().int().positive(),
  currency: z.literal('VND'),
  orderReference: z.string().trim().min(3).max(128),
  bankRecordTimestamp: z.iso.datetime({ offset: true }),
  counterpartyBankIdentity: z.string().trim().min(1).max(128).optional(),
  counterpartyAccountIdentity: z.string().trim().min(1).max(128).optional(),
}).strict();

export { OperatorProtectedBankEvidenceVerifier } from './manual-pilot-protected-bank-verifier';
import { OperatorProtectedBankEvidenceVerifier } from './manual-pilot-protected-bank-verifier';

export async function verifyAndIngestOperatorBankArtifact(
  db: D1Database,
  input: z.input<typeof operatorBankCheckSchema>,
  adminId: string,
  expectedAccountIdentity: string,
  options: { expectedBankIdentity: string; read: (key: string) => Promise<Uint8Array | null>; maxStalenessMs?: number },
): Promise<Result<{
  checkId: string;
  evidenceId: string;
  evidenceLevel: BankEvidenceLevel;
  verificationBasis: BankVerificationBasis;
  idempotent: boolean;
}, ManualPilotError>> {
  const parsed = operatorBankCheckSchema.safeParse(input);
  if (!parsed.success || !adminId || !expectedAccountIdentity.trim()) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Valid operator bank verification input and account required' });
  }
  const data = parsed.data;
  const stored = await db.prepare(`SELECT storage_key, artifact_sha256 FROM manual_pilot_bank_artifacts
    WHERE id=? AND order_id=? AND org_id=? AND direction=?
    AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')`)
    .bind(data.artifactId,data.orderId,data.orgId,data.direction,adminId)
    .first<{storage_key:string; artifact_sha256:string}>();
  const bytes = stored ? await options.read(stored.storage_key) : null;
  if (!stored || !bytes || await sha256BytesHex(bytes) !== stored.artifact_sha256
    || await computeAccountFingerprint(data.bankIdentity,data.accountIdentity)
      !== await computeAccountFingerprint(data.bankIdentity,expectedAccountIdentity)) {
    return failure({code:'VALIDATION_ERROR',message:'Protected original and matching inspected account required'});
  }
  if (options?.expectedBankIdentity && data.bankIdentity.trim().toLowerCase() !== options.expectedBankIdentity.trim().toLowerCase()) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Bank identity does not match configured pilot bank' });
  }
  if (data.direction === 'outbound' && (!data.counterpartyBankIdentity || !data.counterpartyAccountIdentity)) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Outbound refund verification requires counterparty bank and account' });
  }
  const nowMs = Date.now();
  const recordMs = Date.parse(data.bankRecordTimestamp);
  if (!Number.isFinite(recordMs) || recordMs > nowMs) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Invalid or future bank record timestamp' });
  }
  const accountFingerprint = await computeAccountFingerprint(data.bankIdentity, expectedAccountIdentity);
  const existing = await db.prepare(`SELECT id, artifact_id, order_id, org_id, direction, amount_vnd,
    order_reference, original_bank_txn_id, bank_record_timestamp, evidence_id FROM manual_pilot_bank_artifact_checks
    WHERE artifact_id = ? OR (bank_identity = ? AND account_fingerprint = ? AND original_bank_txn_id = ?)`)
    .bind(data.artifactId, data.bankIdentity, accountFingerprint, data.originalBankTxnId)
    .first<{
      id: string; artifact_id: string; order_id: string; org_id: string;
      direction: string; amount_vnd: number; order_reference: string; original_bank_txn_id: string; bank_record_timestamp: string; evidence_id: string | null;
    }>();

  if (existing) {
    const sameAssociation = existing.artifact_id === data.artifactId
      && existing.order_id === data.orderId
      && existing.org_id === data.orgId
      && existing.direction === data.direction
      && existing.amount_vnd === data.amountVnd
      && existing.order_reference === data.orderReference
      && existing.original_bank_txn_id === data.originalBankTxnId
      && existing.bank_record_timestamp === new Date(recordMs).toISOString();
    if (!sameAssociation) {
      return failure({ code: 'DUPLICATE_BANK_REF', message: 'Bank transaction or artifact already bound to another order or value' });
    }
    if (existing.evidence_id) {
      return success({
        checkId: existing.id,
        evidenceId: existing.evidence_id,
        evidenceLevel: 'BANK_RECORD_INDEPENDENTLY_CHECKED',
        verificationBasis: OPERATOR_VERIFIED_BASIS,
        idempotent: true,
      });
    }
  }

  const checkId = existing?.id ?? `mpbc_${crypto.randomUUID()}`;
  const nowIso = new Date(nowMs).toISOString();
  const recordIso = new Date(recordMs).toISOString();
  const auditEventId = crypto.randomUUID();
  if (!existing) {
    try {
      const [inserted] = await db.batch([
        db.prepare(`INSERT INTO manual_pilot_bank_artifact_checks
          (id,artifact_id,order_id,org_id,direction,evidence_level,verification_basis,inspection_source,
           bank_identity,account_fingerprint,original_bank_txn_id,amount_vnd,currency,order_reference,
           bank_record_timestamp,operator_checked_at,verified_by_admin_id,
           counterparty_bank_identity,counterparty_account_identity,audit_event_id)
          SELECT ?,a.id,a.order_id,a.org_id,a.direction,'BANK_RECORD_INDEPENDENTLY_CHECKED',
            'OPERATOR_VERIFIED_BANK_RECORD',?,?,?,?,?,'VND',?,?,?,?,?,?,?
          FROM manual_pilot_bank_artifacts a
          JOIN manual_pilot_settlements s ON s.order_id=a.order_id AND s.org_id=a.org_id
          JOIN manual_pilot_financial_state f ON f.order_id=a.order_id AND f.org_id=a.org_id
          WHERE a.id=? AND a.order_id=? AND a.org_id=? AND a.direction=?
            AND a.evidence_level='BANK_RECORD_RECEIVED'
            AND s.transfer_reference=? AND f.state != 'LEGACY_REVIEW' AND f.state != 'REJECTED'
            AND (a.direction='outbound' OR s.expected_amount_vnd=?)
            AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')`)
          .bind(checkId, data.inspectionSource, data.bankIdentity, accountFingerprint,
            data.originalBankTxnId, data.amountVnd, data.orderReference, recordIso, nowIso, adminId,
            data.counterpartyBankIdentity ?? null, data.counterpartyAccountIdentity ?? null, auditEventId,
            data.artifactId, data.orderId, data.orgId, data.direction, data.orderReference,
            data.amountVnd, adminId),
        db.prepare(`UPDATE manual_pilot_bank_artifacts SET evidence_level='BANK_RECORD_INDEPENDENTLY_CHECKED'
          WHERE id=? AND EXISTS(SELECT 1 FROM manual_pilot_bank_artifact_checks WHERE id=?)`)
          .bind(data.artifactId, checkId),
        db.prepare(`INSERT INTO manual_pilot_financial_events
          (id,order_id,from_state,to_state,actor_id,evidence_id,created_at)
          SELECT audit_event_id,order_id,'BANK_RECORD_RECEIVED','BANK_RECORD_INDEPENDENTLY_CHECKED',
            verified_by_admin_id,id,operator_checked_at
          FROM manual_pilot_bank_artifact_checks WHERE id=?`)
          .bind(checkId),
        db.prepare(`SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM manual_pilot_bank_artifact_checks WHERE id=?)
          OR EXISTS(SELECT 1 FROM manual_pilot_bank_artifact_checks c JOIN manual_pilot_financial_events e
            ON e.id=c.audit_event_id AND e.order_id=c.order_id AND e.evidence_id=c.id
            AND e.to_state='BANK_RECORD_INDEPENDENTLY_CHECKED' WHERE c.id=?)
          THEN 'true' ELSE 'missing operator check audit' END)`)
          .bind(checkId, checkId),
      ]);
      if ((inserted.meta?.changes ?? 0) !== 1) {
        return failure({ code: 'INVALID_STATE', message: 'Protected bank artifact, active admin, exact reference and amount required' });
      }
    } catch {
      return failure({ code: 'DUPLICATE_BANK_REF', message: 'Unable to record unique operator bank check' });
    }
  }

  const verifier = new OperatorProtectedBankEvidenceVerifier(db, expectedAccountIdentity, options?.maxStalenessMs);
  const ingested = await ingestManualPilotEvidence(
    db,
    { orderId: data.orderId, orgId: data.orgId, artifactId: data.artifactId, expectedAccountIdentity },
    verifier,
    checkId,
  );
  if (!ingested.ok) return ingested;

  return success({
    checkId,
    evidenceId: ingested.value.evidenceId,
    evidenceLevel: 'BANK_RECORD_INDEPENDENTLY_CHECKED',
    verificationBasis: OPERATOR_VERIFIED_BASIS,
    idempotent: false,
  });
}
