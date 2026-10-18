/**
 * Cryptographic Merkle Audit Vault: Single Row Verifier
 *
 * Validates genesis linkage, content hash, Merkle leaf hash, and HMAC signature
 * for a single audit ledger row.
 *
 * Layer: tree (Domain logic)
 * @module tree/finance/merkle/row-verifier
 */

import { GENESIS_PREV_HASH } from './types';
import { sha256Hex, hmacSha256Hex } from './hasher';
import { mapRowToAuditRecord } from './ledger-appender';

export type MappedAuditRecord = ReturnType<typeof mapRowToAuditRecord>;

export async function verifySingleAuditRow(
  row: MappedAuditRecord,
  index: number,
  prevExpectedHash: string,
  periodKey: string | undefined,
  secret: string,
): Promise<{ genesisFailed: boolean; issues: string[] }> {
  const issues: string[] = [];
  let genesisFailed = false;

  if (index === 0 && !periodKey && row.prevHash !== GENESIS_PREV_HASH) {
    genesisFailed = true;
    issues.push(
      `Genesis hash mismatch on record ${row.id}: expected ${GENESIS_PREV_HASH}, got ${row.prevHash}`,
    );
  } else if (index > 0 && row.prevHash !== prevExpectedHash) {
    issues.push(
      `Chain break at seq ${row.sequenceNumber}: prev_hash ${row.prevHash} != expected ${prevExpectedHash}`,
    );
  }

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
    issues.push(
      `Content hash tamper detected at seq ${row.sequenceNumber}: stored ${row.contentHash} != computed ${recomputedContentHash}`,
    );
  }

  const recomputedLeaf = await sha256Hex(row.contentHash);
  if (recomputedLeaf !== row.merkleLeafHash) {
    issues.push(
      `Leaf hash mismatch at seq ${row.sequenceNumber}: stored ${row.merkleLeafHash} != computed ${recomputedLeaf}`,
    );
  }

  const recomputedSig = await hmacSha256Hex(row.contentHash, secret);
  if (recomputedSig !== row.digitalSignature) {
    issues.push(`Signature invalid at seq ${row.sequenceNumber}`);
  }

  return { genesisFailed, issues };
}
