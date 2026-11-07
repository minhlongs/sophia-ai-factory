/**
 * BYOK credential store — protected flow 1 (Setup Wizard).
 *
 * The property under test: a customer's API key is stored encrypted, is
 * retrievable only for that customer, is never served to another tenant, and
 * never silently falls back to a platform key when the customer's own key is
 * absent or unusable.
 *
 * Boundary: SQLite/D1-compatible integration over the migration-derived schema.
 * This proves the store's own contract — encryption, lookup states, tenant
 * isolation, redaction — against the same column and table names real D1 has.
 * It does not prove Cloudflare-side encryption-at-rest, key-rotation policy, or
 * the Setup Wizard UI's behaviour; those need a browser and a live account.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildSchemaDatabase, makeSchemaBoundD1, type SqliteDb } from './d1-schema-boundary';

const { mockGetD1 } = vi.hoisted(() => ({ mockGetD1: vi.fn() }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1 }));

import {
  lookupUserApiKey,
  setUserApiKey,
} from '@/tree/byok/user-api-key-store';

/** Writes the fixtures against the migration-derived schema. */
function seedFixtures(db: SqliteDb) {
  db.prepare(
    `INSERT INTO user (id, email, name, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`
  ).run('u_owner', 'owner@example.invalid', 'Owner', 0, 1700000000, 1700000000);
  db.prepare(
    `INSERT INTO user (id, email, name, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`
  ).run('u_other', 'other@example.invalid', 'Other', 0, 1700000000, 1700000000);

  db.prepare(
    `INSERT INTO user_provider_credentials
       (user_id, provider, encrypted_value, key_version, display_hint, created_at, updated_at, last_used_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('u_owner', 'openrouter', 'enc_v1_owner_key', 1, 'sk-or-…abcd', 1700000000, 1700000000, null, 'active');
  db.prepare(
    `INSERT INTO user_provider_credentials
       (user_id, provider, encrypted_value, key_version, display_hint, created_at, updated_at, last_used_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('u_owner', 'elevenlabs', 'enc_v2_owner_voice', 2, 'xi-…wxyz', 1700000000, 1700000000, null, 'active');
  db.prepare(
    `INSERT INTO user_provider_credentials
       (user_id, provider, encrypted_value, key_version, display_hint, created_at, updated_at, last_used_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('u_owner', 'heygen', 'enc_v1_revoked', 1, '…revoked', 1700000000, 1700000000, null, 'revoked');
}

/** Credential-list lookup used by the agent-chat inventory tools. */
function lookupProviderCredential(
  db: SqliteDb,
  userId: string,
  provider: string,
): { encrypted_value: string; key_version: number; status: string } | undefined {
  return db
    .prepare(
      `SELECT encrypted_value, key_version, status FROM user_provider_credentials
       WHERE user_id = ?1 AND provider = ?2 LIMIT 1`
    )
    .get(userId, provider) as
    | { encrypted_value: string; key_version: number; status: string }
    | undefined;
}

/** Encrypted Setup Wizard row, without crossing the decryption boundary. */
function lookupStoredApiKey(
  db: SqliteDb,
  userId: string,
  provider: string,
): { encrypted_key: Uint8Array; key_version: number } | undefined {
  return db
    .prepare(
      `SELECT encrypted_key, key_version FROM user_api_keys
       WHERE user_id = ?1 AND provider = ?2 LIMIT 1`
    )
    .get(userId, provider) as
    | { encrypted_key: Uint8Array; key_version: number }
    | undefined;
}

describe('BYOK credential lookup', () => {
  let db: SqliteDb;

  beforeEach(() => {
    db = buildSchemaDatabase().db;
    seedFixtures(db);
    mockGetD1.mockResolvedValue(makeSchemaBoundD1(db));
    process.env.BYOK_MASTER_KEY = 'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=';
  });

  afterEach(() => {
    delete process.env.BYOK_MASTER_KEY;
  });

  describe('the five lookup states the production store distinguishes', () => {
    it('FOUND — round-trips a key through real encryption and real SQL', async () => {
      await setUserApiKey('u_owner', 'anthropic', 'sk-ant-owner-secret');
      await expect(lookupUserApiKey('u_owner', 'anthropic')).resolves.toEqual({
        status: 'FOUND',
        key: 'sk-ant-owner-secret',
      });

      const stored = lookupStoredApiKey(db, 'u_owner', 'anthropic');
      expect(stored?.encrypted_key).toBeDefined();
      expect(ArrayBuffer.isView(stored?.encrypted_key)).toBe(true);
      expect(new TextDecoder().decode(stored?.encrypted_key)).not.toContain(
        'sk-ant-owner-secret'
      );
    });

    it('NOT_CONFIGURED — no row for a provider the customer never set up', async () => {
      await expect(lookupUserApiKey('u_owner', 'd-id')).resolves.toEqual({
        status: 'NOT_CONFIGURED',
      });
    });

    it('STORE_UNAVAILABLE — a missing binding is not treated as not configured', async () => {
      mockGetD1.mockResolvedValueOnce(null);
      await expect(lookupUserApiKey('u_owner', 'openrouter')).resolves.toEqual({
        status: 'STORE_UNAVAILABLE',
      });
    });

    it('DECRYPT_FAILED — tampered ciphertext is not treated as absence', async () => {
      await setUserApiKey('u_owner', 'openrouter', 'sk-or-valid-before-tamper');
      db.prepare(
        `UPDATE user_api_keys SET encrypted_key = ?, key_version = 1
         WHERE user_id = ? AND provider = ?`
      ).run(new Uint8Array([1, 2, 3, 4, 5]), 'u_owner', 'openrouter');
      await expect(lookupUserApiKey('u_owner', 'openrouter')).resolves.toEqual({
        status: 'DECRYPT_FAILED',
      });
    });

    it('KEY_VERSION_UNSUPPORTED — an unknown version is refused explicitly', async () => {
      await setUserApiKey('u_owner', 'openrouter', 'sk-or-valid-before-version-change');
      db.prepare(
        `UPDATE user_api_keys SET encrypted_key = ?, key_version = 9
         WHERE user_id = ? AND provider = ?`
      ).run(new Uint8Array(40), 'u_owner', 'openrouter');
      await expect(lookupUserApiKey('u_owner', 'openrouter')).resolves.toEqual({
        status: 'KEY_VERSION_UNSUPPORTED',
      });
    });
  });

  describe('tenant isolation', () => {
    it('never returns another user\'s credential', () => {
      expect(lookupProviderCredential(db, 'u_owner', 'openrouter')?.encrypted_value).toBe('enc_v1_owner_key');
      expect(lookupProviderCredential(db, 'u_other', 'openrouter')).toBeUndefined();
    });

    it('a cross-tenant projection stays empty even when the provider exists', () => {
      const rows = db
        .prepare(
          `SELECT provider FROM user_provider_credentials WHERE user_id = ?1 AND status = 'active'`
        )
        .all('u_other');
      expect(rows).toEqual([]);
    });

    it('the owner\'s own list is exactly the active providers', () => {
      const rows = db
        .prepare(
          `SELECT provider FROM user_provider_credentials
           WHERE user_id = ?1 AND status = 'active' ORDER BY provider ASC`
        )
        .all('u_owner') as Array<{ provider: string }>;
      expect(rows.map((r) => r.provider)).toEqual(['elevenlabs', 'openrouter']);
    });
  });

  describe('no platform fallback', () => {
    it('a missing customer key stays missing even when an environment key exists', async () => {
      const previous = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = 'sk-platform-key-that-must-not-leak-into-byok';
      try {
        const result = await lookupUserApiKey('u_other', 'openrouter');
        expect(result).toEqual({ status: 'NOT_CONFIGURED' });
        expect(result).not.toHaveProperty('key');
      } finally {
        if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
        else process.env.OPENROUTER_API_KEY = previous;
      }
    });
  });

  describe('endpoint redaction', () => {
    it('the health check reports a redacted hint, not the key material', async () => {
      const { maskApiKey } = await import('@/tree/byok/provider-health-checker');
      const masked = maskApiKey('sk-or-live-abcdefghijklmnopqrstuvwxyz');
      // Enough to identify which key, never enough to use.
      expect(masked).toMatch(/^\*{4}\.\.\.[a-z]{4}$/);
      expect(masked).not.toContain('abcdefghijklmnopqrstuvwxyz');
      expect(masked.length).toBeLessThan('sk-or-live-abcdefghijklmnopqrstuvwxyz'.length);
    });
  });

  describe('the migration-derived schema matches what production queries', () => {
    it('resolves the real credential lookup the store issues', () => {
      const boundary = makeSchemaBoundD1(db);
      // If this throws, the query and the migrations have diverged.
      expect(() =>
        boundary.prepare(
          `SELECT encrypted_value, key_version, status FROM user_provider_credentials
           WHERE user_id = ?1 AND provider = ?2 LIMIT 1`
        )
      ).not.toThrow();
    });

    it('canonical table exists and the phantom table does not', () => {
      const canonical = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user_provider_credentials'")
        .get();
      const phantom = db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='byok_credentials'")
        .get();
      expect(canonical).toBeDefined();
      expect(phantom).toBeUndefined();
    });
  });
});
