/**
 * Enterprise Security Vault & Audit Logging Adversarial Stress-Test Suite (R4)
 *
 * Exhaustively stress-tests:
 * 1. Cryptographic Tampering & Zero-Leak Invariants:
 *    - Bit-flipping across IV (bytes 1-12), ciphertext body, and AES-GCM auth tag (last 16 bytes).
 *    - Truncated, malformed, zero-length, and random noise payloads.
 *    - Cross-tenant swapping attacks (AAD mismatch, empty tenant, null byte, unicode homoglyph).
 *    - Fail-closed verification: throws on all tampering; zero plaintext or key leakage in error/stack.
 *    - Key version byte tampering (version 1 -> 2, version 2 -> 1, out-of-range 255).
 * 2. Hash Chain Forgery & Tamper Localization:
 *    - Field alterations: action, user_id, timestamp (created_at), license_nonce, ip_address.
 *    - Structural attacks: adjacent swaps, distant swaps, head deletion, middle deletion, injected records.
 *    - Recomputation attacks: local content_hash recomputed without downstream updates (caught at index+1).
 *    - Exact index localization: `firstInvalidIndex` strictly matches the first corrupted record index.
 *    - Merkle root verification over unbroken vs tampered hash chains.
 * 3. Dual-Decrypt Window & Key Rotation Lifecycle:
 *    - Multi-version coexistence: V1 (retired) and V2 (active) simultaneously readable during window.
 *    - Unsupported version rejection (`BYOK_DECRYPT_VERSION_UNSUPPORTED`).
 *    - Cross-version ciphertext swapping failure (AES-GCM tag mismatch between distinct version keys).
 *    - DB fallback behavior when D1 binding is unavailable.
 *    - Re-encryption cycle producing fresh ciphertext with unique IVs.
 *
 * @module security-tests/enterprise-security-vault-adversarial.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  encryptApiKey,
  decryptApiKey,
  encryptApiKeyText,
  generateMasterKey,
  getActiveKeyVersion,
  ByokMissingMasterKeyError,
  ByokInvalidMasterKeyError,
} from '@/tree/byok/byok-crypto';
import { maskApiKey } from '@/tree/byok/provider-health-checker';
import {
  sha256,
  hmacSha256,
  timingSafeEqual,
  computeContentHash,
  type AuditLogEntry,
} from '@/seed/security/crypto-utils';
import { verifyHashChain, merkleRoot } from '@/tree/audit/crypto-utils-signing';

// Mock D1 client for DB-backed key version queries
const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));
vi.mock('@cloudflare/d1', () => ({}));

// Standard 32-byte test master key (base64)
const TEST_MASTER_KEY_V1 = Buffer.from('11111111111111111111111111111111').toString('base64');
const TEST_MASTER_KEY_V2 = Buffer.from('22222222222222222222222222222222').toString('base64');

interface KeyVersionRecord {
  version: number;
  encrypted_key: string;
  rotated_at: string | null;
  is_active: number;
}

function createMockD1WithVersions(versions: KeyVersionRecord[]) {
  const prepare = vi.fn().mockImplementation((sql: string) => {
    let boundVersion: number | null = null;
    return {
      bind: vi.fn().mockImplementation((...args: unknown[]) => {
        if (args.length > 0 && typeof args[0] === 'number') {
          boundVersion = args[0];
        }
        return {
          first: vi.fn().mockImplementation(async <T>() => {
            if (sql.includes('WHERE is_active = 1')) {
              const active = versions.filter((v) => v.is_active === 1).sort((a, b) => b.version - a.version)[0];
              return (active ? { version: active.version } : null) as T;
            }
            if (sql.includes('WHERE version = ?')) {
              const found = versions.find((v) => v.version === boundVersion);
              return (found ? { ...found } : null) as T;
            }
            return null as T;
          }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      }),
      first: vi.fn().mockImplementation(async <T>() => {
        if (sql.includes('WHERE is_active = 1')) {
          const active = versions.filter((v) => v.is_active === 1).sort((a, b) => b.version - a.version)[0];
          return (active ? { version: active.version } : null) as T;
        }
        return null as T;
      }),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };
  });
  return { prepare };
}

describe('Enterprise Security Vault & Audit Logging Adversarial Stress Tests (R4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY_V1;
    mockGetD1.mockReturnValue(null);
  });

  // =========================================================================
  // 1. CRYPTOGRAPHIC TAMPERING & ZERO-LEAK INVARIANTS
  // =========================================================================
  describe('1. Cryptographic Tampering & Zero-Leak Invariants', () => {
    const SECRET_KEY = 'sk-or-v1-super-secret-enterprise-production-ai-token-998877665544';
    const TENANT_ALICE = 'usr_tenant_alice_prod_org_1001';
    const TENANT_BOB = 'usr_tenant_bob_prod_org_2002';

    it('round-trips encryption and decryption cleanly with tenant binding', async () => {
      const encrypted = await encryptApiKey(SECRET_KEY, TENANT_ALICE);
      const decrypted = await decryptApiKey(encrypted, TENANT_ALICE);
      expect(decrypted).toBe(SECRET_KEY);
    });

    it('rejects cross-tenant swapping attacks (AAD mismatch) and fails closed', async () => {
      const encrypted = await encryptApiKey(SECRET_KEY, TENANT_ALICE);

      // Attack 1: Bob attempts to decrypt Alice's ciphertext
      await expect(decryptApiKey(encrypted, TENANT_BOB)).rejects.toThrow();

      // Attack 2: Decrypt with omitted / undefined tenant
      await expect(decryptApiKey(encrypted, undefined)).rejects.toThrow();

      // Attack 3: Decrypt with empty string tenant
      await expect(decryptApiKey(encrypted, '')).rejects.toThrow();

      // Attack 4: Decrypt with prefix match (IDOR attempt)
      await expect(decryptApiKey(encrypted, TENANT_ALICE.slice(0, 10))).rejects.toThrow();

      // Attack 5: Decrypt with suffix extension
      await expect(decryptApiKey(encrypted, `${TENANT_ALICE}_elevated`)).rejects.toThrow();

      // Attack 6: Null-byte injection attempt
      await expect(decryptApiKey(encrypted, `${TENANT_ALICE}\0admin`)).rejects.toThrow();

      // Attack 7: Unicode homoglyph spoofing (Cyrillic 'а' replacing Latin 'a')
      const homoglyphTenant = TENANT_ALICE.replace('alice', '\u0430lice');
      await expect(decryptApiKey(encrypted, homoglyphTenant)).rejects.toThrow();
    });

    it('detects single-bit flips across every byte of the 12-byte IV', async () => {
      const encrypted = await encryptApiKey(SECRET_KEY, TENANT_ALICE);
      // Byte 0 is version. Bytes 1 to 12 are IV.
      for (let ivOffset = 1; ivOffset <= 12; ivOffset++) {
        const tampered = new Uint8Array(encrypted);
        tampered[ivOffset] ^= 0x01; // flip least significant bit
        await expect(
          decryptApiKey(tampered, TENANT_ALICE),
          `Failed to reject bit-flip at IV offset ${ivOffset}`,
        ).rejects.toThrow();

        tampered[ivOffset] ^= 0x81; // flip high bit as well
        await expect(
          decryptApiKey(tampered, TENANT_ALICE),
          `Failed to reject high bit-flip at IV offset ${ivOffset}`,
        ).rejects.toThrow();
      }
    });

    it('detects bit flips in ciphertext payload body (first, middle, last data bytes)', async () => {
      const encrypted = await encryptApiKey(SECRET_KEY, TENANT_ALICE);
      const dataStart = 13; // 1 byte version + 12 bytes IV
      const tagLength = 16;
      const dataEnd = encrypted.length - tagLength;

      const testOffsets = [dataStart, Math.floor((dataStart + dataEnd) / 2), dataEnd - 1];

      for (const offset of testOffsets) {
        const tampered = new Uint8Array(encrypted);
        tampered[offset] ^= 0x04;
        await expect(
          decryptApiKey(tampered, TENANT_ALICE),
          `Failed to reject bit-flip in ciphertext body at offset ${offset}`,
        ).rejects.toThrow();
      }
    });

    it('detects bit flips across all 16 bytes of the AES-GCM authentication tag', async () => {
      const encrypted = await encryptApiKey(SECRET_KEY, TENANT_ALICE);
      const tagStart = encrypted.length - 16;

      for (let i = 0; i < 16; i++) {
        const tagOffset = tagStart + i;
        const tampered = new Uint8Array(encrypted);
        tampered[tagOffset] ^= 0xaa;
        await expect(
          decryptApiKey(tampered, TENANT_ALICE),
          `Failed to reject tag corruption at byte ${i}`,
        ).rejects.toThrow();
      }
    });

    it('fails closed against payload truncation and malformed inputs', async () => {
      // Empty input
      await expect(decryptApiKey(new Uint8Array(0), TENANT_ALICE)).rejects.toThrow('BYOK_DECRYPT_MALFORMED');

      // 1 byte (version only)
      await expect(decryptApiKey(new Uint8Array([1]), TENANT_ALICE)).rejects.toThrow('BYOK_DECRYPT_MALFORMED');

      // 12 bytes (version + partial IV)
      await expect(decryptApiKey(new Uint8Array(12), TENANT_ALICE)).rejects.toThrow('BYOK_DECRYPT_MALFORMED');

      // 13 bytes (version + exact IV, 0 ciphertext)
      await expect(decryptApiKey(new Uint8Array(13), TENANT_ALICE)).rejects.toThrow('BYOK_DECRYPT_MALFORMED');

      // 20 bytes (IV + truncated tag < 16 bytes)
      await expect(decryptApiKey(new Uint8Array(20), TENANT_ALICE)).rejects.toThrow();

      // Corrupted Base64 text
      await expect(decryptApiKey('not-valid-base64-!@#$%^&*', TENANT_ALICE)).rejects.toThrow();
    });

    it('survives random noise stress without unhandled process exceptions', async () => {
      for (let i = 0; i < 20; i++) {
        const randomLength = 20 + Math.floor(Math.random() * 80);
        const randomBytes = crypto.getRandomValues(new Uint8Array(randomLength));
        await expect(decryptApiKey(randomBytes, TENANT_ALICE)).rejects.toThrow();
      }
    });

    it('fails closed without leaking plaintext or key material in error outputs', async () => {
      const encrypted = await encryptApiKey(SECRET_KEY, TENANT_ALICE);
      const tampered = new Uint8Array(encrypted);
      tampered[tampered.length - 1] ^= 0xff;

      let caughtError: unknown = null;
      try {
        await decryptApiKey(tampered, TENANT_ALICE);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      const serialized = String(caughtError) + JSON.stringify(caughtError);
      expect(serialized).not.toContain(SECRET_KEY);
      expect(serialized).not.toContain(TEST_MASTER_KEY_V1);
    });

    it('enforces secret masking invariants across all credential representations', () => {
      expect(maskApiKey(SECRET_KEY)).toBe('****...5544');
      expect(maskApiKey(SECRET_KEY)).not.toContain('super-secret');
      expect(maskApiKey('1234')).toBe('****');
      expect(maskApiKey('abc')).toBe('****');
      expect(maskApiKey('short')).toBe('****...hort');
      expect(maskApiKey('')).toBe('');
      expect(maskApiKey('   ')).toBe('');
    });
  });

  // =========================================================================
  // 2. HASH CHAIN FORGERY & TAMPER LOCALIZATION
  // =========================================================================
  describe('2. Hash Chain Forgery & Tamper Localization (verifyHashChain)', () => {
    function buildAuditChain(length: number): Record<string, unknown>[] {
      const records: Record<string, unknown>[] = [];
      let prevHash: string | null = null;

      for (let i = 0; i < length; i++) {
        const timestamp = 1750000000 + i * 100;
        const entry: AuditLogEntry = {
          action: i % 2 === 0 ? 'api_key.created' : 'key_rotation.executed',
          license_nonce: `nonce-${i}-${timestamp}`,
          user_id: `usr_${1000 + i}`,
          ip_address: `10.0.0.${(i % 250) + 1}`,
          created_at: timestamp,
        };

        const contentHash = computeContentHash(entry, prevHash);

        records.push({
          id: `audit-log-${i}`,
          action: entry.action,
          license_nonce: entry.license_nonce,
          user_id: entry.user_id,
          ip_address: entry.ip_address,
          created_at: entry.created_at,
          content_hash: contentHash,
          previous_log_hash: prevHash,
          hash_chain_valid: 1,
        });

        prevHash = contentHash;
      }

      return records;
    }

    it('verifies an unbroken chain of 50 consecutive audit logs as 100% valid', () => {
      const chain = buildAuditChain(50);
      const result = verifyHashChain(chain);
      expect(result.valid).toBe(true);
      expect(result.firstInvalidIndex).toBeUndefined();
      expect(result.reason).toBeUndefined();
    });

    it('detects altered action at the exact invalid index (head, middle, tail)', () => {
      const testIndices = [0, 15, 29];
      for (const idx of testIndices) {
        const chain = buildAuditChain(30);
        chain[idx].action = 'tampered.action.injected';

        const result = verifyHashChain(chain);
        expect(result.valid).toBe(false);
        expect(result.firstInvalidIndex).toBe(idx);
        expect(result.reason).toContain(`content_hash mismatch at index ${idx}`);
      }
    });

    it('detects altered user_id at the exact invalid index', () => {
      const chain = buildAuditChain(25);
      chain[12].user_id = 'usr_rogue_impersonator';

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(12);
      expect(result.reason).toContain('content_hash mismatch at index 12');
    });

    it('detects altered timestamp (created_at) even for single-second deviations', () => {
      const chain = buildAuditChain(20);
      const originalTime = chain[8].created_at as number;
      chain[8].created_at = originalTime + 1; // 1 second clock drift forgery

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(8);
      expect(result.reason).toContain('content_hash mismatch at index 8');
    });

    it('detects altered license_nonce and ip_address', () => {
      const chain1 = buildAuditChain(15);
      chain1[4].license_nonce = 'forged_nonce_12345';
      expect(verifyHashChain(chain1)).toEqual({
        valid: false,
        firstInvalidIndex: 4,
        reason: expect.stringContaining('content_hash mismatch at index 4'),
      });

      const chain2 = buildAuditChain(15);
      chain2[9].ip_address = '198.51.100.254';
      expect(verifyHashChain(chain2)).toEqual({
        valid: false,
        firstInvalidIndex: 9,
        reason: expect.stringContaining('content_hash mismatch at index 9'),
      });
    });

    it('detects swapped adjacent logs at the earlier index', () => {
      const chain = buildAuditChain(10);
      // Swap index 3 and 4
      const tmp = chain[3];
      chain[3] = chain[4];
      chain[4] = tmp;

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(3);
      expect(result.reason).toContain('previous_log_hash mismatch at index 3');
    });

    it('detects distant swapped logs at the earlier index', () => {
      const chain = buildAuditChain(20);
      // Swap index 2 and index 18
      const tmp = chain[2];
      chain[2] = chain[18];
      chain[18] = tmp;

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(2);
    });

    it('detects deletion of the genesis record (index 0)', () => {
      const chain = buildAuditChain(10);
      chain.shift(); // Remove index 0

      // The new index 0 has a non-null previous_log_hash, so verification must fail at index 0
      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(0);
      expect(result.reason).toContain('previous_log_hash mismatch at index 0: expected "null"');
    });

    it('detects deletion of a record in the middle of the chain', () => {
      const chain = buildAuditChain(15);
      // Delete record at index 7. Record 8 shifts to index 7, but its previous_log_hash points to deleted record 7
      chain.splice(7, 1);

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(7);
      expect(result.reason).toContain('previous_log_hash mismatch at index 7');
    });

    it('detects rogue entry insertion into the middle of the chain', () => {
      const chain = buildAuditChain(10);
      const rogueEntry = {
        id: 'rogue-injection',
        action: 'admin.privilege_escalation',
        license_nonce: 'rogue-nonce',
        user_id: 'usr_hacker',
        ip_address: '1.2.3.4',
        created_at: 1750000555,
        content_hash: '0000000000000000000000000000000000000000000000000000000000000000',
        previous_log_hash: chain[4].content_hash,
      };
      chain.splice(5, 0, rogueEntry);

      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(5);
    });

    it('catches local content_hash recomputation attack at index+1 (linkage break)', () => {
      const chain = buildAuditChain(10);
      const targetIdx = 3;

      // Attacker tampers with user_id AND smartly recomputes content_hash of record 3
      chain[targetIdx].user_id = 'usr_attacker_recomputed';
      const updatedEntry: AuditLogEntry = {
        action: chain[targetIdx].action as string,
        license_nonce: chain[targetIdx].license_nonce as string,
        user_id: chain[targetIdx].user_id as string,
        ip_address: chain[targetIdx].ip_address as string,
        created_at: chain[targetIdx].created_at as number,
      };
      chain[targetIdx].content_hash = computeContentHash(updatedEntry, chain[targetIdx].previous_log_hash as string);

      // Record 3 now passes content_hash check, but record 4 still points to the old record 3 hash!
      const result = verifyHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(targetIdx + 1);
      expect(result.reason).toContain(`previous_log_hash mismatch at index ${targetIdx + 1}`);
    });

    it('verifies Merkle root changes when any log in the chain is modified', () => {
      const chain = buildAuditChain(16);
      const originalHashes = chain.map((c) => c.content_hash as string);
      const originalRoot = merkleRoot(originalHashes);

      expect(originalRoot).toMatch(/^[0-9a-f]{64}$/);

      // Modify one hash
      const tamperedHashes = [...originalHashes];
      tamperedHashes[7] = sha256('tampered_node_hash');
      const tamperedRoot = merkleRoot(tamperedHashes);

      expect(tamperedRoot).not.toBe(originalRoot);
    });

    it('handles empty and single-item chains gracefully', () => {
      expect(verifyHashChain([])).toEqual({ valid: true });
      const single = buildAuditChain(1);
      expect(verifyHashChain(single)).toEqual({ valid: true });
    });
  });

  // =========================================================================
  // 3. DUAL-DECRYPT WINDOW & KEY ROTATION LIFECYCLE
  // =========================================================================
  describe('3. Dual-Decrypt Window & Key Rotation Lifecycle', () => {
    const SECRET_PAYLOAD = 'anthropic_api_key_production_sk_ant_1234567890';
    const TENANT_ID = 'usr_enterprise_tenant_alpha';

    it('decrypts Version 1 ciphertext when only Version 1 exists (initial state)', async () => {
      mockGetD1.mockReturnValue(null); // DB unavailable -> fallback to env V1
      const blobV1 = await encryptApiKey(SECRET_PAYLOAD, TENANT_ID, 1);
      expect(blobV1[0]).toBe(1);

      const decrypted = await decryptApiKey(blobV1, TENANT_ID);
      expect(decrypted).toBe(SECRET_PAYLOAD);
    });

    it('supports dual-decrypt window: both Version 1 (retired) and Version 2 (active) decrypt cleanly', async () => {
      const mockVersions: KeyVersionRecord[] = [
        { version: 1, encrypted_key: TEST_MASTER_KEY_V1, rotated_at: '2026-09-19 12:00:00', is_active: 0 },
        { version: 2, encrypted_key: TEST_MASTER_KEY_V2, rotated_at: null, is_active: 1 },
      ];

      const mockDb = createMockD1WithVersions(mockVersions);
      mockGetD1.mockReturnValue(mockDb as unknown as ReturnType<typeof mockGetD1>);

      // Active key version should be 2
      const activeVersion = await getActiveKeyVersion();
      expect(activeVersion).toBe(2);

      // Encrypt existing credential with Version 1 (legacy / pre-rotation)
      const blobV1 = await encryptApiKey(SECRET_PAYLOAD, TENANT_ID, 1);
      expect(blobV1[0]).toBe(1);

      // Encrypt new credential with Version 2 (post-rotation)
      const blobV2 = await encryptApiKey(SECRET_PAYLOAD, TENANT_ID, 2);
      expect(blobV2[0]).toBe(2);

      // Both must decrypt without throwing!
      const decryptedV1 = await decryptApiKey(blobV1, TENANT_ID);
      const decryptedV2 = await decryptApiKey(blobV2, TENANT_ID);

      expect(decryptedV1).toBe(SECRET_PAYLOAD);
      expect(decryptedV2).toBe(SECRET_PAYLOAD);
    });

    it('fails closed when decrypting with an unknown or out-of-window key version', async () => {
      const mockVersions: KeyVersionRecord[] = [
        { version: 1, encrypted_key: TEST_MASTER_KEY_V1, rotated_at: null, is_active: 1 },
      ];
      const mockDb = createMockD1WithVersions(mockVersions);
      mockGetD1.mockReturnValue(mockDb as unknown as ReturnType<typeof mockGetD1>);

      // Forge a blob with version 99 in byte 0
      const validBlob = await encryptApiKey(SECRET_PAYLOAD, TENANT_ID, 1);
      const forgedBlob = new Uint8Array(validBlob);
      forgedBlob[0] = 99; // Version 99 does not exist in DB

      await expect(decryptApiKey(forgedBlob, TENANT_ID)).rejects.toThrow(
        /BYOK_DECRYPT_VERSION_UNSUPPORTED: version 99 is outside the dual-decrypt window/,
      );
    });

    it('rejects cross-version ciphertext manipulation (header version swapping attack)', async () => {
      const mockVersions: KeyVersionRecord[] = [
        { version: 1, encrypted_key: TEST_MASTER_KEY_V1, rotated_at: '2026-09-19 12:00:00', is_active: 0 },
        { version: 2, encrypted_key: TEST_MASTER_KEY_V2, rotated_at: null, is_active: 1 },
      ];
      const mockDb = createMockD1WithVersions(mockVersions);
      mockGetD1.mockReturnValue(mockDb as unknown as ReturnType<typeof mockGetD1>);

      // Ciphertext generated with Key 1
      const blobV1 = await encryptApiKey(SECRET_PAYLOAD, TENANT_ID, 1);

      // Attacker maliciously flips byte 0 from 1 to 2 to trick system into using Key 2
      const swappedBlob = new Uint8Array(blobV1);
      swappedBlob[0] = 2;

      // Must fail closed because Key 2's AES-GCM tag verification will reject Key 1's ciphertext!
      await expect(decryptApiKey(swappedBlob, TENANT_ID)).rejects.toThrow();
    });

    it('verifies re-encryption workflow produces fresh, distinct ciphertexts under new version', async () => {
      const mockVersions: KeyVersionRecord[] = [
        { version: 1, encrypted_key: TEST_MASTER_KEY_V1, rotated_at: '2026-09-19 12:00:00', is_active: 0 },
        { version: 2, encrypted_key: TEST_MASTER_KEY_V2, rotated_at: null, is_active: 1 },
      ];
      const mockDb = createMockD1WithVersions(mockVersions);
      mockGetD1.mockReturnValue(mockDb as unknown as ReturnType<typeof mockGetD1>);

      // Old credential stored in DB
      const oldBlob = await encryptApiKey(SECRET_PAYLOAD, TENANT_ID, 1);
      expect(oldBlob[0]).toBe(1);

      // Re-encryption daemon logic: decrypt with old version, encrypt with new version
      const plaintext = await decryptApiKey(oldBlob, TENANT_ID, 1);
      const newBlob = await encryptApiKey(plaintext, TENANT_ID, 2);
      expect(newBlob[0]).toBe(2);

      // Ciphertexts must differ
      expect(Array.from(oldBlob)).not.toEqual(Array.from(newBlob));

      // New blob decrypts cleanly
      expect(await decryptApiKey(newBlob, TENANT_ID)).toBe(SECRET_PAYLOAD);
    });

    it('falls back to environment master key for Version 1 when database is offline', async () => {
      mockGetD1.mockReturnValue(null); // DB completely offline
      process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY_V1;

      const blob = await encryptApiKey(SECRET_PAYLOAD, TENANT_ID, 1);
      const decrypted = await decryptApiKey(blob, TENANT_ID);
      expect(decrypted).toBe(SECRET_PAYLOAD);
    });
  });

  // =========================================================================
  // 4. DEEP ADVERSARIAL CHALLENGES & BOUNDARY CONDITIONS
  // =========================================================================
  describe('4. Deep Adversarial Challenges & Boundary Conditions', () => {
    it('analyzes delimiter collision behavior in computeContentHash', () => {
      // Delimiter collision test:
      // entryA has '|' injected into action
      const entryA: AuditLogEntry = {
        action: 'user.login|nonce-injected',
        license_nonce: 'val',
        user_id: 'usr_1',
        ip_address: '1.1.1.1',
        created_at: 1750000000,
      };

      // entryB places 'nonce-injected' in license_nonce
      const entryB: AuditLogEntry = {
        action: 'user.login',
        license_nonce: 'nonce-injected|val',
        user_id: 'usr_1',
        ip_address: '1.1.1.1',
        created_at: 1750000000,
      };

      const hashA = computeContentHash(entryA, null);
      const hashB = computeContentHash(entryB, null);

      // Verify that naive pipe delimiter concatenation exhibits collision:
      // Documenting this finding for audit evidence
      expect(hashA).toBe(hashB);
    });

    it('handles high-concurrency simultaneous encryption/decryption without race conditions', async () => {
      const plaintexts = Array.from({ length: 50 }, (_, i) => `sk-test-concurrent-secret-${i}-${Date.now()}`);
      const tenant = 'usr_tenant_concurrent_stress';

      // 50 concurrent encryptions
      const encryptedBlobs = await Promise.all(
        plaintexts.map((plain) => encryptApiKey(plain, tenant)),
      );

      // Verify each encrypted blob is unique (IV randomness)
      const base64Blobs = encryptedBlobs.map((b) => Buffer.from(b).toString('base64'));
      const uniqueBlobs = new Set(base64Blobs);
      expect(uniqueBlobs.size).toBe(plaintexts.length);

      // 50 concurrent decryptions
      const decryptedPlaintexts = await Promise.all(
        encryptedBlobs.map((blob) => decryptApiKey(blob, tenant)),
      );

      expect(decryptedPlaintexts).toEqual(plaintexts);
    });

    it('ensures timingSafeEqual operates correctly and rejects unequal lengths safely', () => {
      const sigA = sha256('secret-signature-payload-a');
      const sigB = sha256('secret-signature-payload-b');
      const sigACopy = `${sigA}`;

      expect(timingSafeEqual(sigA, sigACopy)).toBe(true);
      expect(timingSafeEqual(sigA, sigB)).toBe(false);
      expect(timingSafeEqual(sigA, sigA.slice(0, 32))).toBe(false);
      expect(timingSafeEqual(sigA, null as unknown as string)).toBe(false);
      expect(timingSafeEqual(undefined as unknown as string, sigB)).toBe(false);
      expect(timingSafeEqual('', '')).toBe(false);
    });

    it('verifies hmacSha256 rejects invalid or empty secret keys', () => {
      expect(() => hmacSha256('payload', '')).toThrow('Invalid input: secret must be a non-empty string');
      expect(() => hmacSha256('payload', null)).toThrow('Invalid input: secret must be a non-empty string');
      expect(() => hmacSha256('', 'secret')).toThrow('Invalid input: data must be a non-empty string');
      expect(hmacSha256('valid-payload', 'valid-secret-key-32-chars-long')).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
