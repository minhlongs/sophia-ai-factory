/**
 * @file chain-verifier.ts
 * @description Cryptographic hash-chain traversal, tampering detection, and verification.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ChainVerificationResult } from './types';
import {
  checkPrevHashLink,
  verifySingleChainRow,
} from './chain-row-verifier';

export { checkPrevHashLink, verifySingleChainRow };

/**
 * Traverses and verifies the entire cryptographic hash-chain for an organization or zone.
 * Detects any data tampering, payload modification, or missing/injected records.
 */
export async function verifyComplianceAuditChain(
  db: D1Database,
  options: {
    orgId?: string | null;
    zoneId?: string;
    signingKeySecret?: string;
    limit?: number;
  } = {},
): Promise<ChainVerificationResult> {
  let query = 'SELECT * FROM compliance_audit_logs';
  const bindings: unknown[] = [];
  const whereClauses: string[] = [];

  if (options.orgId) {
    whereClauses.push('org_id = ?' + (bindings.length + 1));
    bindings.push(options.orgId);
  } else if (options.zoneId) {
    whereClauses.push('zone_id = ?' + (bindings.length + 1));
    bindings.push(options.zoneId);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY timestamp ASC, created_at ASC, id ASC';

  if (options.limit) {
    query += ' LIMIT ?' + (bindings.length + 1);
    bindings.push(options.limit);
  }

  const { results } = await db
    .prepare(query)
    .bind(...bindings)
    .all<Record<string, unknown>>();

  const rows = results || [];
  if (rows.length === 0) {
    return {
      isValid: true,
      checkedCount: 0,
      genesisHash: undefined,
      latestHash: undefined,
    };
  }

  let previousCalculatedHash: string | null = null;
  const genesisHash = String(rows[0].content_hash);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const check = await verifySingleChainRow(row, i, previousCalculatedHash, options.signingKeySecret);

    if (!check.isValid) {
      return {
        isValid: false,
        checkedCount: i,
        tamperedEventId: String(row.id),
        tamperedIndex: i,
        error: check.error,
      };
    }

    previousCalculatedHash = check.recomputedHash ?? null;
  }

  const latestHash = String(rows[rows.length - 1].content_hash);

  return {
    isValid: true,
    checkedCount: rows.length,
    genesisHash,
    latestHash,
  };
}
