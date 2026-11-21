import type { D1Database } from '@cloudflare/workers-types';
import { failure, success, type Result } from '@/seed/types/result';
import type { ManualPilotError } from './types';

export interface VerifiedBankArtifact {
  bankIdentity: string;
  accountIdentity: string;
  transactionIdentity: string;
  amountVnd: number;
  currency: 'VND';
  direction: 'inbound' | 'outbound';
  settledAt: string;
  orderReference: string;
  artifactSha256: string;
  source: string;
  verifier: string;
  counterpartyBankIdentity?: string;
  counterpartyAccountIdentity?: string;
}

/** Injected by server wiring, never deserialized from an HTTP request.
 * Implementations must retrieve an independent bank artifact and verify it.
 * There is deliberately no permissive/default production implementation.
 */
export interface BankEvidenceVerifier {
  verify(artifactId: string): Promise<VerifiedBankArtifact | null>;
}

export async function ingestManualPilotEvidence(
  db: D1Database,
  input: { orderId: string; orgId: string; artifactId: string; expectedAccountIdentity: string },
  verifier?: BankEvidenceVerifier,
  operatorCheckId?: string,
): Promise<Result<{ evidenceId: string }, ManualPilotError>> {
  if (!verifier) return failure({ code: 'VALIDATION_ERROR', message: 'Independent bank verifier unavailable' });
  try {
    const artifact = await verifier.verify(input.artifactId);
    if (!artifact || !Number.isSafeInteger(artifact.amountVnd) || artifact.amountVnd <= 0
      || !['inbound', 'outbound'].includes(artifact.direction)
      || (artifact.direction === 'outbound' && (!artifact.counterpartyBankIdentity?.trim() || !artifact.counterpartyAccountIdentity?.trim()))
      || artifact.currency !== 'VND' || !/^[a-f0-9]{64}$/i.test(artifact.artifactSha256)
      || !artifact.bankIdentity || !artifact.transactionIdentity || !artifact.verifier || !artifact.source
      || artifact.source === 'BANK_API_VERIFIED' || artifact.verifier === 'BANK_API_VERIFIED'
      || !Number.isFinite(Date.parse(artifact.settledAt)) || Date.parse(artifact.settledAt) > Date.now()
      || artifact.accountIdentity !== input.expectedAccountIdentity) {
      return failure({ code: 'VALIDATION_ERROR', message: 'Invalid independent bank evidence' });
    }
    const order = await db.prepare(`SELECT s.transfer_reference, f.org_id
      FROM manual_pilot_settlements s JOIN manual_pilot_financial_state f USING(order_id)
      WHERE s.order_id = ? AND f.org_id = ? AND f.state != 'LEGACY_REVIEW'`)
      .bind(input.orderId, input.orgId).first<{ transfer_reference: string; org_id: string }>();
    if (!order || order.transfer_reference !== artifact.orderReference) {
      return failure({ code: 'VALIDATION_ERROR', message: 'Evidence does not match tenant order' });
    }
    const id = crypto.randomUUID();
    await db.batch([db.prepare(`INSERT INTO manual_pilot_bank_evidence
      (id,order_id,org_id,direction,bank_identity,account_identity,transaction_identity,
       amount_vnd,currency,settled_at,order_reference,artifact_sha256,source,verifier,verified_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,input.orderId,input.orgId,artifact.direction,
      artifact.bankIdentity,artifact.accountIdentity,artifact.transactionIdentity,artifact.amountVnd,
      artifact.currency,new Date(artifact.settledAt).toISOString(),artifact.orderReference,artifact.artifactSha256,
      artifact.source,artifact.verifier,new Date().toISOString()),
      ...(artifact.direction === 'outbound' ? [db.prepare(`INSERT INTO manual_pilot_bank_counterparties
        (evidence_id,bank_identity,account_identity) VALUES (?,?,?)`)
        .bind(id, artifact.counterpartyBankIdentity!, artifact.counterpartyAccountIdentity!)] : []),
      ...(operatorCheckId ? [db.prepare(`UPDATE manual_pilot_bank_artifact_checks SET evidence_id=?
        WHERE id=? AND artifact_id=? AND order_id=? AND org_id=? AND evidence_id IS NULL`)
        .bind(id,operatorCheckId,input.artifactId,input.orderId,input.orgId),
      db.prepare(`SELECT json(CASE WHEN EXISTS(SELECT 1 FROM manual_pilot_bank_artifact_checks
        WHERE id=? AND evidence_id=?) THEN 'true' ELSE 'missing bank evidence association' END)`)
        .bind(operatorCheckId,id)] : []),
      db.prepare(`SELECT json(CASE WHEN EXISTS(SELECT 1 FROM manual_pilot_bank_evidence e
        WHERE e.id=?1 AND (e.direction='inbound' OR EXISTS(SELECT 1 FROM manual_pilot_bank_counterparties c
          WHERE c.evidence_id=e.id AND c.bank_identity=?2 AND c.account_identity=?3)))
        THEN 'true' ELSE 'missing verified bank evidence' END)`)
        .bind(id, artifact.counterpartyBankIdentity ?? null, artifact.counterpartyAccountIdentity ?? null),
    ]);
    return success({ evidenceId: id });
  } catch {
    return failure({ code: 'DB_ERROR', message: 'Unable to persist independently verified evidence' });
  }
}
