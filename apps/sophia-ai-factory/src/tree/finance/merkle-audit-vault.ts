/**
 * Cryptographic Merkle Audit Vault & Tamper-Evident IPO Ledger
 *
 * Implements:
 * - Deterministic canonical JSON key sorting
 * - SHA-256 hash chaining & HMAC-SHA256 digital signature
 * - Binary Merkle tree generation with O(log N) inclusion proofs
 * - SEC Form S-1 Audit Pack generation & VAS TT200 certification
 * - Full ledger chain integrity verification and tamper detection
 *
 * Layer: tree (Pure domain logic, depends only on @/seed and @/tree)
 *
 * @module tree/finance/merkle-audit-vault
 */

import type { D1Database } from '@/seed/db/client';
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

export const GENESIS_PREV_HASH = 'GENESIS_GATE8_S1_VAULT';
export const DEFAULT_AUDIT_SECRET = 'SOPHIA_AUDIT_VAULT_HMAC_SECRET_2026';

/**
 * Deterministic canonical JSON serialization with recursive alphabetical key sorting
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * SHA-256 hash computation returning 64-char lowercase hex string
 */
export async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * HMAC-SHA256 signature computation returning 64-char lowercase hex string
 */
export async function hmacSha256Hex(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build a complete binary Merkle tree from an ordered list of leaf hashes
 */
export async function buildMerkleTree(
  leafHashes: string[]
): Promise<{ rootHash: string; levels: string[][] }> {
  if (leafHashes.length === 0) {
    const emptyRoot = await sha256Hex('EMPTY_PERIOD_GENESIS');
    return { rootHash: emptyRoot, levels: [[emptyRoot]] };
  }

  if (leafHashes.length === 1) {
    return { rootHash: leafHashes[0], levels: [[leafHashes[0]]] };
  }

  const levels: string[][] = [];
  let currentLevel = [...leafHashes];
  levels.push([...currentLevel]);

  while (currentLevel.length > 1) {
    if (currentLevel.length % 2 !== 0) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const combined = currentLevel[i] + currentLevel[i + 1];
      const parentHash = await sha256Hex(combined);
      nextLevel.push(parentHash);
    }

    levels.push([...nextLevel]);
    currentLevel = nextLevel;
  }

  return { rootHash: currentLevel[0], levels };
}

/**
 * Generate an O(log N) Merkle inclusion proof for a leaf at targetIndex
 */
export async function generateMerkleProof(
  leafHashes: string[],
  targetIndex: number
): Promise<MerkleProof> {
  if (leafHashes.length === 0 || targetIndex < 0 || targetIndex >= leafHashes.length) {
    throw new Error(`Invalid leaf index ${targetIndex} for total leaves ${leafHashes.length}`);
  }

  const { rootHash } = await buildMerkleTree(leafHashes);
  const targetLeaf = leafHashes[targetIndex];

  if (leafHashes.length === 1) {
    return {
      rootHash,
      leafHash: targetLeaf,
      index: targetIndex,
      totalLeaves: 1,
      proofHashes: [],
      proofDirections: [],
      isValid: true,
    };
  }

  const proofHashes: string[] = [];
  const proofDirections: ('left' | 'right')[] = [];

  let currentLevel = [...leafHashes];
  let currentIndex = targetIndex;

  while (currentLevel.length > 1) {
    if (currentLevel.length % 2 !== 0) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    const isEven = currentIndex % 2 === 0;
    const siblingIndex = isEven ? currentIndex + 1 : currentIndex - 1;

    proofHashes.push(currentLevel[siblingIndex]);
    proofDirections.push(isEven ? 'right' : 'left');

    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const parent = await sha256Hex(currentLevel[i] + currentLevel[i + 1]);
      nextLevel.push(parent);
    }

    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    rootHash,
    leafHash: targetLeaf,
    index: targetIndex,
    totalLeaves: leafHashes.length,
    proofHashes,
    proofDirections,
    isValid: true,
  };
}

/**
 * Verify a Merkle inclusion proof against an expected root hash
 */
export async function verifyMerkleProof(
  proof: MerkleProof,
  expectedRoot: string
): Promise<boolean> {
  if (proof.totalLeaves === 1) {
    return proof.leafHash === expectedRoot;
  }

  let currentHash = proof.leafHash;
  for (let i = 0; i < proof.proofHashes.length; i++) {
    const sibling = proof.proofHashes[i];
    const direction = proof.proofDirections[i];
    const combined = direction === 'right' ? currentHash + sibling : sibling + currentHash;
    currentHash = await sha256Hex(combined);
  }

  return currentHash === expectedRoot;
}

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

interface RawAuditLedgerRow {
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

export function mapRowToAuditRecord(row: RawAuditLedgerRow): IpoAuditLedgerRecord {
  return {
    id: row.id,
    sequenceNumber: Number(row.sequence_number),
    periodKey: row.period_key,
    orgId: row.org_id,
    eventType: row.event_type,
    eventScope: row.event_scope,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    amountCents: Number(row.amount_cents),
    payloadCanonicalJson: row.payload_canonical_json,
    prevHash: row.prev_hash,
    contentHash: row.content_hash,
    merkleLeafHash: row.merkle_leaf_hash,
    digitalSignature: row.digital_signature,
    soxControlId: row.sox_control_id,
    vasAccountCode: row.vas_account_code,
    timestamp: Number(row.timestamp),
    createdAt: Number(row.created_at),
  };
}

/**
 * Append an immutable audit event to the IPO audit ledger with hash chaining and signature
 */
export async function appendIpoAuditEvent(
  db: D1Database,
  input: AppendAuditEventInput,
  secret: string = DEFAULT_AUDIT_SECRET
): Promise<IpoAuditLedgerRecord> {
  const lastRow = await db
    .prepare(
      `SELECT sequence_number, content_hash
       FROM ipo_audit_ledger
       ORDER BY sequence_number DESC
       LIMIT 1`
    )
    .first<{ sequence_number: number; content_hash: string }>();

  const nextSeq = lastRow ? Number(lastRow.sequence_number) + 1 : 1;
  const prevHash = lastRow ? lastRow.content_hash : GENESIS_PREV_HASH;

  const id = crypto.randomUUID().replace(/-/g, '').toLowerCase();
  const timestamp = input.timestamp ?? Date.now();
  const amountCents = input.amountCents ?? 0;
  const canonicalPayload = canonicalJson(input.payload);
  const soxControl = input.soxControlId ?? 'NONE';
  const vasAccount = input.vasAccountCode ?? null;

  // content_hash formula
  const contentDigestInput = [
    prevHash,
    String(nextSeq),
    input.periodKey,
    input.eventType,
    input.actorId,
    String(amountCents),
    canonicalPayload,
  ].join(':');

  const contentHash = await sha256Hex(contentDigestInput);
  const merkleLeafHash = await sha256Hex(contentHash);
  const digitalSignature = await hmacSha256Hex(contentHash, secret);
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO ipo_audit_ledger (
        id, sequence_number, period_key, org_id, event_type, event_scope,
        actor_id, actor_role, amount_cents, payload_canonical_json,
        prev_hash, content_hash, merkle_leaf_hash, digital_signature,
        sox_control_id, vas_account_code, timestamp, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`
    )
    .bind(
      id,
      nextSeq,
      input.periodKey,
      input.orgId ?? null,
      input.eventType,
      input.eventScope,
      input.actorId,
      input.actorRole,
      amountCents,
      canonicalPayload,
      prevHash,
      contentHash,
      merkleLeafHash,
      digitalSignature,
      soxControl,
      vasAccount,
      timestamp,
      now
    )
    .run();

  return {
    id,
    sequenceNumber: nextSeq,
    periodKey: input.periodKey,
    orgId: input.orgId ?? null,
    eventType: input.eventType,
    eventScope: input.eventScope,
    actorId: input.actorId,
    actorRole: input.actorRole,
    amountCents,
    payloadCanonicalJson: canonicalPayload,
    prevHash,
    contentHash,
    merkleLeafHash,
    digitalSignature,
    soxControlId: soxControl,
    vasAccountCode: vasAccount,
    timestamp,
    createdAt: now,
  };
}

/**
 * Verify complete hash-chain cryptographic integrity of the audit ledger
 */
export async function verifyAuditLedgerChain(
  db: D1Database,
  periodKey?: string,
  secret: string = DEFAULT_AUDIT_SECRET
): Promise<LedgerIntegrityResult> {
  let query = `SELECT * FROM ipo_audit_ledger`;
  const params: unknown[] = [];
  if (periodKey) {
    query += ` WHERE period_key = ?1`;
    params.push(periodKey);
  }
  query += ` ORDER BY sequence_number ASC`;

  const { results } = await db.prepare(query).bind(...params).all<RawAuditLedgerRow>();
  const rows = (results ?? []).map(mapRowToAuditRecord);

  const discrepancies: string[] = [];
  let prevExpectedHash = GENESIS_PREV_HASH;
  let genesisValid = true;
  let brokenIndex: number | null = null;
  let tamperedId: string | null = null;
  const leafHashes: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    leafHashes.push(row.merkleLeafHash);

    // If first record overall and not filtered by period, check genesis
    if (i === 0 && !periodKey && row.prevHash !== GENESIS_PREV_HASH) {
      genesisValid = false;
      discrepancies.push(`Genesis hash mismatch on record ${row.id}: expected ${GENESIS_PREV_HASH}, got ${row.prevHash}`);
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    } else if (i > 0 && row.prevHash !== prevExpectedHash) {
      discrepancies.push(
        `Chain break at seq ${row.sequenceNumber}: prev_hash ${row.prevHash} != expected ${prevExpectedHash}`
      );
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    }

    // Recompute content_hash
    const expectedContentDigest = [
      row.prevHash,
      String(row.sequenceNumber),
      row.periodKey,
      row.eventType,
      row.actorId,
      String(row.amountCents),
      row.payloadCanonicalJson,
    ].join(':');

    const recomputedContentHash = await sha256Hex(expectedContentDigest);
    if (recomputedContentHash !== row.contentHash) {
      discrepancies.push(
        `Content hash tamper detected at seq ${row.sequenceNumber}: stored ${row.contentHash} != computed ${recomputedContentHash}`
      );
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    }

    // Recompute leaf hash
    const recomputedLeaf = await sha256Hex(row.contentHash);
    if (recomputedLeaf !== row.merkleLeafHash) {
      discrepancies.push(
        `Leaf hash mismatch at seq ${row.sequenceNumber}: stored ${row.merkleLeafHash} != computed ${recomputedLeaf}`
      );
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    }

    // Recompute HMAC signature
    const recomputedSig = await hmacSha256Hex(row.contentHash, secret);
    if (recomputedSig !== row.digitalSignature) {
      discrepancies.push(`Signature invalid at seq ${row.sequenceNumber}`);
      if (brokenIndex === null) {
        brokenIndex = i;
        tamperedId = row.id;
      }
    }

    prevExpectedHash = row.contentHash;
  }

  const { rootHash: computedMerkleRoot } = await buildMerkleTree(leafHashes);

  let anchoredMerkleRoot: string | null = null;
  if (periodKey) {
    const periodRow = await db
      .prepare(`SELECT merkle_root_hash FROM financial_close_periods WHERE period_key = ?1 LIMIT 1`)
      .bind(periodKey)
      .first<{ merkle_root_hash: string | null }>();
    if (periodRow) {
      anchoredMerkleRoot = periodRow.merkle_root_hash;
      if (anchoredMerkleRoot && anchoredMerkleRoot !== computedMerkleRoot) {
        discrepancies.push(
          `Anchored Merkle root mismatch for period ${periodKey}: anchored ${anchoredMerkleRoot} != computed ${computedMerkleRoot}`
        );
      }
    }
  }

  return {
    isValid: discrepancies.length === 0,
    totalRecordsChecked: rows.length,
    genesisHashValid: genesisValid,
    brokenSequenceIndex: brokenIndex,
    tamperedRecordId: tamperedId,
    computedMerkleRoot,
    anchoredMerkleRoot,
    discrepancies,
  };
}

/**
 * Generate a complete, SEC Form S-1 / VAS TT200 audit disclosure pack
 */
export async function generateFormS1AuditPack(
  db: D1Database,
  periodKey: string,
  secret: string = DEFAULT_AUDIT_SECRET
): Promise<FormS1AuditPack> {
  const periodRow = await db
    .prepare(`SELECT * FROM financial_close_periods WHERE period_key = ?1 LIMIT 1`)
    .bind(periodKey)
    .first<{
      period_type: PeriodType;
      start_date: string;
      end_date: string;
      close_status: CloseStatus;
      audit_opinion: AuditOpinion;
      total_recognized_revenue_cents: number;
      total_deferred_revenue_cents: number;
      total_refunds_cents: number;
      net_revenue_cents: number;
      active_contracts_count: number;
      merkle_root_hash: string | null;
      digital_signature: string | null;
    }>();

  if (!periodRow) {
    throw new Error(`Financial close period ${periodKey} not found`);
  }

  // Intercompany roll-up
  const ictAggregates = await db
    .prepare(
      `SELECT
         COUNT(*) as total_transfers,
         COALESCE(SUM(gross_amount_cents), 0) as gross_cents,
         COALESCE(SUM(withholding_tax_amount_cents), 0) as wht_cents,
         COALESCE(SUM(net_settlement_cents), 0) as net_cents
       FROM intercompany_transfers
       WHERE transfer_date >= ?1 AND transfer_date <= ?2`
    )
    .bind(periodRow.start_date, periodRow.end_date)
    .first<{
      total_transfers: number;
      gross_cents: number;
      wht_cents: number;
      net_cents: number;
    }>();

  // Audit events for period
  const integrity = await verifyAuditLedgerChain(db, periodKey, secret);

  const controlsEvaluated: SoxControlId[] = [
    'CC-1.1',
    'CC-2.1',
    'CC-3.2',
    'CC-5.1',
    'AC-4.1',
    'AC-6.2',
  ];

  return {
    periodKey,
    periodType: periodRow.period_type,
    startDate: periodRow.start_date,
    endDate: periodRow.end_date,
    closeStatus: periodRow.close_status,
    auditOpinion: periodRow.audit_opinion,
    financialMetrics: {
      totalGrossContractValueCents:
        Number(periodRow.total_recognized_revenue_cents) + Number(periodRow.total_deferred_revenue_cents),
      recognizedRevenueCents: Number(periodRow.total_recognized_revenue_cents),
      deferredRevenueCents: Number(periodRow.total_deferred_revenue_cents),
      refundsCents: Number(periodRow.total_refunds_cents),
      netRevenueCents: Number(periodRow.net_revenue_cents),
      activeContractsCount: Number(periodRow.active_contracts_count),
    },
    intercompanySummary: {
      totalTransfersCount: Number(ictAggregates?.total_transfers ?? 0),
      grossTransfersCents: Number(ictAggregates?.gross_cents ?? 0),
      totalWithholdingTaxCents: Number(ictAggregates?.wht_cents ?? 0),
      netSettledCents: Number(ictAggregates?.net_cents ?? 0),
    },
    merkleVerification: {
      rootHash: periodRow.merkle_root_hash ?? integrity.computedMerkleRoot ?? '',
      digitalSignature: periodRow.digital_signature ?? '',
      totalAuditedEvents: integrity.totalRecordsChecked,
      integrityVerified: integrity.isValid,
    },
    soxComplianceAttestation: {
      controlsEvaluated,
      attestationTimestamp: Date.now(),
      signOffStatus: integrity.isValid ? 'CERTIFIED' : 'EXCEPTION_NOTED',
    },
  };
}
