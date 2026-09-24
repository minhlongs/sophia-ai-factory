/**
 * Cryptographic Hash-Chain Audit Vault Engine
 *
 * Implements an immutable, tamper-evident audit ledger conforming to SOC 2 CC7.2 standards.
 * Every audit event is cryptographically linked to the previous event:
 *
 *   content_hash = sha256(prev_hash + timestamp + action + actor + payload)
 *
 * Layer: tree (Domain logic & cryptographic audit verification)
 * Allowed imports: @/seed/*, standard libraries
 *
 * @module tree/audit/enterprise-audit-vault
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseAuditEvent,
  EnterpriseAuditRow,
  ChainVerificationResult,
  AuditFilterOptions,
  RecordEnterpriseAuditInput,
} from '@/seed/types/enterprise-audit';
import { logger } from '@/seed/utils/logger-utility';
import { createHash, randomBytes } from 'node:crypto';

// ── Deterministic Canonical Serialization ─────────────────────────────────────

/**
 * Deterministically serialize a JavaScript value to canonical JSON.
 * Recursively sorts all object keys alphabetically to guarantee that
 * identical payloads produce the identical string representation.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalJson(item));
    return `[${items.join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);

  return `{${pairs.join(',')}}`;
}

/**
 * Canonical formula for Enterprise Audit Content Hash:
 * content_hash = sha256(prev_hash + timestamp + action + actor + payload)
 *
 * Format: `${prevHash || 'GENESIS'}|${timestamp}|${action}|${actorId}|${canonicalJson(payload)}`
 */
export function computeEnterpriseContentHash(
  prevHash: string | null,
  timestamp: number,
  action: string,
  actorId: string,
  payload: Record<string, unknown> = {},
): string {
  const normalizedPrev = prevHash || 'GENESIS';
  const canonicalPayload = canonicalJson(payload);
  const data = `${normalizedPrev}|${timestamp}|${action}|${actorId}|${canonicalPayload}`;

  return createHash('sha256').update(data).digest('hex');
}

// ── Row Mapping ───────────────────────────────────────────────────────────────

function mapRowToAuditEvent(row: EnterpriseAuditRow): EnterpriseAuditEvent {
  let parsedPayload: Record<string, unknown> = {};
  try {
    parsedPayload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    parsedPayload = { _raw: row.payload };
  }

  return {
    id: row.id,
    orgId: row.org_id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    payload: parsedPayload,
    prevHash: row.prev_hash,
    contentHash: row.content_hash,
    timestamp: row.timestamp,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

// ── Core Audit Vault API ──────────────────────────────────────────────────────

/**
 * Atomically records an enterprise audit event into the cryptographic hash-chain.
 * Resolves the previous hash in the chain and computes content_hash deterministically.
 */
export async function recordEnterpriseAuditEvent(
  db: D1Database,
  input: RecordEnterpriseAuditInput,
): Promise<EnterpriseAuditEvent> {
  const orgId = input.orgId ?? null;
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const now = Math.floor(Date.now() / 1000);
  const id = randomBytes(16).toString('hex');
  const payload = input.payload ?? {};
  const serializedPayload = canonicalJson(payload);

  // 1. Fetch latest event in this organization's chain (or global chain if orgId is null)
  let latestRow: { content_hash: string } | null = null;
  if (orgId) {
    latestRow = await db
      .prepare(
        `SELECT content_hash
         FROM enterprise_audit_events
         WHERE org_id = ?1
         ORDER BY timestamp DESC, created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .bind(orgId)
      .first<{ content_hash: string }>();
  } else {
    latestRow = await db
      .prepare(
        `SELECT content_hash
         FROM enterprise_audit_events
         WHERE org_id IS NULL
         ORDER BY timestamp DESC, created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .first<{ content_hash: string }>();
  }

  const prevHash = latestRow ? latestRow.content_hash : null;

  // 2. Compute canonical content hash
  const contentHash = computeEnterpriseContentHash(
    prevHash,
    timestamp,
    input.action,
    input.actorId,
    payload,
  );

  // 3. Insert record into D1
  await db
    .prepare(
      `INSERT INTO enterprise_audit_events (
        id, org_id, actor_id, actor_email, action, resource_type,
        resource_id, payload, prev_hash, content_hash, timestamp,
        ip_address, user_agent, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
    )
    .bind(
      id,
      orgId,
      input.actorId,
      input.actorEmail ?? null,
      input.action,
      input.resourceType,
      input.resourceId ?? null,
      serializedPayload,
      prevHash,
      contentHash,
      timestamp,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      now,
    )
    .run();

  return {
    id,
    orgId,
    actorId: input.actorId,
    actorEmail: input.actorEmail ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    payload,
    prevHash,
    contentHash,
    timestamp,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: now,
  };
}

/**
 * Sequentially verifies the cryptographic hash chain for an organization (or global trail).
 * Recomputes all content hashes from the genesis record forward.
 * Pinpoints the exact index, record ID, and cause of any corruption or tampering.
 */
export async function verifyEnterpriseAuditChain(
  db: D1Database,
  orgId?: string,
): Promise<ChainVerificationResult> {
  const verifiedAt = new Date().toISOString();

  let query = `
    SELECT id, org_id, actor_id, actor_email, action, resource_type,
           resource_id, payload, prev_hash, content_hash, timestamp,
           ip_address, user_agent, created_at
    FROM enterprise_audit_events
  `;
  const params: unknown[] = [];

  if (orgId) {
    query += ' WHERE org_id = ?1';
    params.push(orgId);
  }

  query += ' ORDER BY timestamp ASC, created_at ASC, rowid ASC';

  const stmt = db.prepare(query);
  const { results } = params.length > 0 ? await stmt.bind(...params).all<EnterpriseAuditRow>() : await stmt.all<EnterpriseAuditRow>();

  const rows = results || [];
  if (rows.length === 0) {
    return {
      valid: true,
      totalEvents: 0,
      verifiedAt,
      genesisHash: null,
      latestHash: null,
    };
  }

  let expectedPrevHash: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Check 1: prev_hash alignment
    if (i === 0) {
      if (row.prev_hash !== null) {
        return {
          valid: false,
          totalEvents: rows.length,
          tamperedIndex: 0,
          tamperedEventId: row.id,
          reason: `Genesis event at index 0 must have prev_hash = null, but found "${row.prev_hash}"`,
          verifiedAt,
        };
      }
    } else {
      if (row.prev_hash !== expectedPrevHash) {
        return {
          valid: false,
          totalEvents: rows.length,
          tamperedIndex: i,
          tamperedEventId: row.id,
          reason: `Broken hash link at index ${i}: event references prev_hash "${row.prev_hash}", expected "${expectedPrevHash}"`,
          verifiedAt,
        };
      }
    }

    // Check 2: Content hash re-computation
    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      return {
        valid: false,
        totalEvents: rows.length,
        tamperedIndex: i,
        tamperedEventId: row.id,
        reason: `Corrupted payload at index ${i}: invalid JSON payload string`,
        verifiedAt,
      };
    }

    const recomputedHash = computeEnterpriseContentHash(
      row.prev_hash,
      row.timestamp,
      row.action,
      row.actor_id,
      parsedPayload,
    );

    if (row.content_hash !== recomputedHash) {
      return {
        valid: false,
        totalEvents: rows.length,
        tamperedIndex: i,
        tamperedEventId: row.id,
        reason: `Tampered content at index ${i}: recorded content_hash "${row.content_hash}" differs from recomputed "${recomputedHash}"`,
        verifiedAt,
      };
    }

    expectedPrevHash = row.content_hash;
  }

  return {
    valid: true,
    totalEvents: rows.length,
    genesisHash: rows[0].content_hash,
    latestHash: rows[rows.length - 1].content_hash,
    verifiedAt,
  };
}

/**
 * Searches and paginates enterprise audit events with multi-field filtering.
 */
export async function queryEnterpriseAuditEvents(
  db: D1Database,
  filters: AuditFilterOptions = {},
): Promise<{ events: EnterpriseAuditEvent[]; total: number }> {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];

  if (filters.orgId) {
    params.push(filters.orgId);
    conditions.push(`org_id = ?${params.length}`);
  }

  if (filters.action && filters.action !== 'all') {
    params.push(filters.action);
    conditions.push(`action = ?${params.length}`);
  }

  if (filters.actorId) {
    params.push(filters.actorId);
    conditions.push(`actor_id = ?${params.length}`);
  }

  if (filters.actorEmail) {
    params.push(`%${filters.actorEmail}%`);
    conditions.push(`actor_email LIKE ?${params.length}`);
  }

  if (filters.resourceType && filters.resourceType !== 'all') {
    params.push(filters.resourceType);
    conditions.push(`resource_type = ?${params.length}`);
  }

  if (typeof filters.fromTimestamp === 'number') {
    params.push(filters.fromTimestamp);
    conditions.push(`timestamp >= ?${params.length}`);
  }

  if (typeof filters.toTimestamp === 'number') {
    params.push(filters.toTimestamp);
    conditions.push(`timestamp <= ?${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  // Count total matching rows
  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM enterprise_audit_events WHERE ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();

  const total = countRow?.total ?? 0;

  // Retrieve paginated records
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const queryParams = [...params, limit, offset];
  const querySql = `
    SELECT id, org_id, actor_id, actor_email, action, resource_type,
           resource_id, payload, prev_hash, content_hash, timestamp,
           ip_address, user_agent, created_at
    FROM enterprise_audit_events
    WHERE ${whereClause}
    ORDER BY timestamp DESC, created_at DESC
    LIMIT ?${params.length + 1} OFFSET ?${params.length + 2}
  `;

  const { results } = await db.prepare(querySql).bind(...queryParams).all<EnterpriseAuditRow>();

  const events = (results || []).map(mapRowToAuditEvent);

  return { events, total };
}
