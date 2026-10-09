/**
 * Cryptographic Merkle Audit Vault: Types & Constants
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/finance/merkle/types
 */

import type {
  IpoAuditLedgerRecord,
  AuditEventType,
  EventScope,
  ActorRole,
  SoxControlId,
  MerkleProof,
  LedgerIntegrityResult,
  FormS1AuditPack,
  PeriodType,
  CloseStatus,
  AuditOpinion,
} from '@/seed/types/financial-close';

export type {
  IpoAuditLedgerRecord,
  AuditEventType,
  EventScope,
  ActorRole,
  SoxControlId,
  MerkleProof,
  LedgerIntegrityResult,
  FormS1AuditPack,
  PeriodType,
  CloseStatus,
  AuditOpinion,
};

export const GENESIS_PREV_HASH = 'GENESIS_GATE8_S1_VAULT';
export const DEFAULT_AUDIT_SECRET = 'SOPHIA_AUDIT_VAULT_HMAC_SECRET_2026';

export interface AppendAuditEventInput {
  periodKey: string;
  orgId?: string | null;
  eventType: AuditEventType;
  eventScope: EventScope;
  actorId: string;
  actorRole: ActorRole;
  amountCents?: number;
  payload: Record<string, unknown>;
  soxControlId?: SoxControlId;
  vasAccountCode?: string | null;
  timestamp?: number;
}

export interface RawAuditLedgerRow {
  id: string;
  sequence_number: number;
  period_key: string;
  org_id: string | null;
  event_type: AuditEventType;
  event_scope: EventScope;
  actor_id: string;
  actor_role: ActorRole;
  amount_cents: number;
  payload_canonical_json: string;
  prev_hash: string;
  content_hash: string;
  merkle_leaf_hash: string;
  digital_signature: string;
  sox_control_id: SoxControlId;
  vas_account_code: string | null;
  timestamp: number;
  created_at: number;
}
