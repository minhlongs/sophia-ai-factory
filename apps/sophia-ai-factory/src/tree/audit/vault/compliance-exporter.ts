/**
 * SOC 2 CC7.2 compliance hash-chain verification and integrity validator.
 *
 * @module tree/audit/vault/compliance-exporter
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EnterpriseAuditRow,
  ChainVerificationResult,
} from '@/seed/types/enterprise-audit';
import { computeEnterpriseContentHash } from './merkle-chain';

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
  const { results } =
    params.length > 0
      ? await stmt.bind(...params).all<EnterpriseAuditRow>()
      : await stmt.all<EnterpriseAuditRow>();

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
