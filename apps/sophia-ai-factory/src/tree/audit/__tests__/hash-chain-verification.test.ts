/**
 * SOC 2 Type I Hash Chain Verification Tests
 *
 * Verifies:
 * - Deterministic content hashing (`computeContentHash`) format and properties
 * - Tamper detection (modified action, swapped log, altered user, modified timestamp)
 * - Hash chain linkage continuity (`previous_log_hash` === predecessor `content_hash`)
 * - Multi-entry immutable chain verification (`verifyHashChain`)
 * - SOC 2 CC7.2 compliance invariants
 */

import { describe, it, expect } from 'vitest';
import { computeContentHash } from '@/seed/security/crypto-utils';
import type { AuditLogEntry } from '@/seed/security/crypto-utils';
import { verifyHashChain } from '../crypto-utils-signing';

function createLogEntry(
  index: number,
  previousHash: string | null,
  overrides: Partial<AuditLogEntry> = {},
): { entry: AuditLogEntry; record: Record<string, unknown> } {
  const timestamp = 1750000000 + index * 60;
  const entry: AuditLogEntry = {
    action: overrides.action ?? 'api_key.created',
    license_nonce: overrides.license_nonce ?? `nonce-${index}`,
    user_id: overrides.user_id ?? `usr_${index}`,
    ip_address: overrides.ip_address ?? `192.168.1.${index % 255}`,
    created_at: overrides.created_at ?? timestamp,
  };

  const contentHash = computeContentHash(entry, previousHash);

  const record: Record<string, unknown> = {
    id: `log-${index}`,
    action: entry.action,
    license_nonce: entry.license_nonce,
    user_id: entry.user_id,
    ip_address: entry.ip_address,
    created_at: entry.created_at,
    content_hash: contentHash,
    previous_log_hash: previousHash,
    hash_chain_valid: 1,
  };

  return { entry, record };
}

function buildValidChain(length: number): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  let prevHash: string | null = null;

  for (let i = 0; i < length; i++) {
    const { record } = createLogEntry(i, prevHash);
    records.push(record);
    prevHash = record.content_hash as string;
  }

  return records;
}

describe('SOC 2 Immutable Hash Chain Verification', () => {
  describe('Deterministic Content Hashing (computeContentHash)', () => {
    it('generates consistent 64-char hex SHA-256 for identical inputs', () => {
      const entry: AuditLogEntry = {
        action: 'key_rotation.requested',
        license_nonce: 'nonce-abc-123',
        user_id: 'usr_admin_42',
        ip_address: '10.0.0.1',
        created_at: 1750000000,
      };
      const hash1 = computeContentHash(entry, null);
      const hash2 = computeContentHash(entry, null);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('changes output when any input field is modified (avalanche effect)', () => {
      const baseEntry: AuditLogEntry = {
        action: 'key_rotation.requested',
        license_nonce: 'nonce-abc-123',
        user_id: 'usr_admin_42',
        ip_address: '10.0.0.1',
        created_at: 1750000000,
      };
      const baseHash = computeContentHash(baseEntry, 'prev-hash-000');

      // Action altered
      const alteredAction = computeContentHash({ ...baseEntry, action: 'key_rotation.tampered' }, 'prev-hash-000');
      expect(alteredAction).not.toBe(baseHash);

      // User ID altered
      const alteredUser = computeContentHash({ ...baseEntry, user_id: 'usr_attacker' }, 'prev-hash-000');
      expect(alteredUser).not.toBe(baseHash);

      // Nonce altered
      const alteredNonce = computeContentHash({ ...baseEntry, license_nonce: 'nonce-forged' }, 'prev-hash-000');
      expect(alteredNonce).not.toBe(baseHash);

      // IP altered
      const alteredIp = computeContentHash({ ...baseEntry, ip_address: '1.1.1.1' }, 'prev-hash-000');
      expect(alteredIp).not.toBe(baseHash);

      // Timestamp altered
      const alteredTime = computeContentHash({ ...baseEntry, created_at: 1750000001 }, 'prev-hash-000');
      expect(alteredTime).not.toBe(baseHash);

      // Previous hash altered
      const alteredPrev = computeContentHash(baseEntry, 'prev-hash-tampered');
      expect(alteredPrev).not.toBe(baseHash);
    });

    it('handles first log entry with null previous hash correctly', () => {
      const entry: AuditLogEntry = {
        action: 'system.init',
        license_nonce: 'init-nonce',
        user_id: 'system',
        ip_address: '127.0.0.1',
        created_at: 1750000000,
      };
      const hash = computeContentHash(entry, null);
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });

  describe('Cryptographic Hash Chain Verification (verifyHashChain)', () => {
    it('verifies an empty log list as valid', () => {
      const result = verifyHashChain([]);
      expect(result.valid).toBe(true);
    });

    it('verifies a single valid log record', () => {
      const chain = buildValidChain(1);
      const result = verifyHashChain(chain);
      expect(result.valid).toBe(true);
    });

    it('verifies an unbroken chain of 50 audit logs', () => {
      const chain = buildValidChain(50);
      const result = verifyHashChain(chain);
      expect(result.valid).toBe(true);
      expect(result.firstInvalidIndex).toBeUndefined();
      expect(result.reason).toBeUndefined();
    });

    it('detects forged content within an entry (content_hash mismatch)', () => {
      const chain = buildValidChain(10);
      // Attacker tampers with user_id at index 4 without updating content_hash
      chain[4].user_id = 'usr_impersonated';

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(4);
      expect(result.reason).toContain('content_hash mismatch at index 4');
    });

    it('detects swapped entries (previous_log_hash linkage break)', () => {
      const chain = buildValidChain(6);
      // Swap entries at index 2 and index 3
      const temp = chain[2];
      chain[2] = chain[3];
      chain[3] = temp;

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(2);
      expect(result.reason).toContain('previous_log_hash mismatch at index 2');
    });

    it('detects deletion of an entry from the middle of the chain', () => {
      const chain = buildValidChain(10);
      // Delete record at index 5
      chain.splice(5, 1);

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(5);
      expect(result.reason).toContain('previous_log_hash mismatch at index 5');
    });

    it('detects modification of the initial entry previous_log_hash', () => {
      const chain = buildValidChain(5);
      // First entry should have previous_log_hash = null, attacker injects a rogue hash
      chain[0].previous_log_hash = 'rogue_predecessor_hash_000000000000000000000000000000000000000000';

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(0);
      expect(result.reason).toContain('previous_log_hash mismatch at index 0');
    });
  });
});
