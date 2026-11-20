import type { D1Database } from '@cloudflare/workers-types';
import type { BankEvidenceVerifier, VerifiedBankArtifact } from './manual-pilot-evidence';
import type { BankEvidenceLevel } from './types';
import { computeAccountFingerprint } from './manual-pilot-bank-artifact-intake';
const OPERATOR_VERIFIED_BASIS = 'OPERATOR_VERIFIED_BANK_RECORD';
const DEFAULT_CHECK_MAX_STALENESS_MS = 86400000;
interface ArtifactCheckRow {
  check_id: string;
  artifact_id: string;
  order_id: string;
  org_id: string;
  direction: 'inbound' | 'outbound';
  evidence_level: BankEvidenceLevel;
  verification_basis: string;
  inspection_source: string;
  bank_identity: string;
  account_fingerprint: string;
  original_bank_txn_id: string;
  amount_vnd: number;
  currency: string;
  order_reference: string;
  bank_record_timestamp: string;
  operator_checked_at: string;
  counterparty_bank_identity: string | null;
  counterparty_account_identity: string | null;
  evidence_id: string | null;
  storage_key: string;
  artifact_sha256: string;
  admin_role: string | null;
}

/**
 * Production BankEvidenceVerifier that reads an operator-checked protected bank
 * artifact from D1 and enforces freshness, active admin role, and account fingerprint.
 */
export class OperatorProtectedBankEvidenceVerifier implements BankEvidenceVerifier {
  constructor(
    private readonly db: D1Database,
    private readonly expectedAccountIdentity: string,
    private readonly maxStalenessMs: number = DEFAULT_CHECK_MAX_STALENESS_MS,
  ) {}

  async verify(artifactId: string): Promise<VerifiedBankArtifact | null> {
    const row = await this.db.prepare(`SELECT
      c.id AS check_id, c.artifact_id, c.order_id, c.org_id, c.direction, c.evidence_level,
      c.verification_basis, c.inspection_source, c.bank_identity, c.account_fingerprint,
      c.original_bank_txn_id, c.amount_vnd, c.currency, c.order_reference,
      c.bank_record_timestamp, c.operator_checked_at,
      c.counterparty_bank_identity, c.counterparty_account_identity, c.evidence_id,
      a.storage_key, a.artifact_sha256, u.role AS admin_role
      FROM manual_pilot_bank_artifact_checks c
      JOIN manual_pilot_bank_artifacts a ON a.id = c.artifact_id
      LEFT JOIN user_profiles u ON u.user_id = c.verified_by_admin_id
      WHERE c.artifact_id = ?`).bind(artifactId).first<ArtifactCheckRow>();

    if (!row) return null;
    if (row.admin_role !== 'admin') return null;
    if (row.evidence_level !== 'BANK_RECORD_INDEPENDENTLY_CHECKED') return null;
    if (row.verification_basis !== OPERATOR_VERIFIED_BASIS) return null;
    if (!['authenticated_bank_portal', 'official_bank_statement'].includes(row.inspection_source)) return null;
    if (!row.storage_key.startsWith('private/manual-pilot-bank-artifacts/') || row.storage_key.includes('..')) return null;

    const expectedFingerprint = await computeAccountFingerprint(row.bank_identity, this.expectedAccountIdentity);
    if (row.account_fingerprint !== expectedFingerprint) return null;

    const nowMs = Date.now();
    const recordMs = Date.parse(row.bank_record_timestamp);
    const checkedMs = Date.parse(row.operator_checked_at);
    if (!Number.isFinite(recordMs) || !Number.isFinite(checkedMs)) return null;
    if (recordMs > nowMs || checkedMs > nowMs || checkedMs < recordMs) return null;
    if (nowMs - checkedMs > this.maxStalenessMs) return null;

    return {
      bankIdentity: row.bank_identity,
      accountIdentity: this.expectedAccountIdentity,
      transactionIdentity: row.original_bank_txn_id,
      amountVnd: row.amount_vnd,
      currency: 'VND',
      direction: row.direction,
      settledAt: new Date(recordMs).toISOString(),
      orderReference: row.order_reference,
      artifactSha256: row.artifact_sha256,
      source: OPERATOR_VERIFIED_BASIS,
      verifier: 'operator-protected-bank-artifact-verifier',
      counterpartyBankIdentity: row.counterparty_bank_identity ?? undefined,
      counterpartyAccountIdentity: row.counterparty_account_identity ?? undefined,
    };
  }
}
