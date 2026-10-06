/**
 * Unit Test Suite: AGY Tenant Token Cryptographic Engine
 *
 * Tests HMAC-SHA256 token issuance, cryptographic verification,
 * tamper detection, expiration checking, and granular permissions.
 *
 * Layer: tree/agy/__tests__
 */

import { describe, it, expect } from 'vitest';
import {
  generateTenantToken,
  verifyTenantTokenSignature,
  validateTokenPermissions,
  hashTenantToken,
} from '../tenant-token-engine';

const TEST_SECRET = 'ultra-secure-test-secret-key-for-agy-tokens-32bytes';
const OTHER_SECRET = 'different-secret-key-that-should-fail-verification';

describe('Tenant Token Cryptographic Engine', () => {
  describe('generateTenantToken', () => {
    it('generates a valid token with agy_tok_ prefix and proper structure', async () => {
      const result = await generateTenantToken(
        {
          agencyId: 'agy_acme_123',
          name: 'CI/CD Worker Token',
          permissions: ['read', 'write', 'video:generate'],
          expiresInSeconds: 3600,
        },
        TEST_SECRET
      );

      expect(result.token).toMatch(/^agy_tok_[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
      expect(result.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.payload.agencyId).toBe('agy_acme_123');
      expect(result.payload.name).toBe('CI/CD Worker Token');
      expect(result.payload.permissions).toEqual(['read', 'write', 'video:generate']);
      expect(result.payload.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(result.model.id).toMatch(/^tok_[0-9a-f]{16}$/);
    });

    it('generates non-expiring token when expiresInSeconds is null or 0', async () => {
      const result = await generateTenantToken(
        {
          agencyId: 'agy_perpetual',
          name: 'Long-term Token',
          expiresInSeconds: null,
        },
        TEST_SECRET
      );

      expect(result.payload.expiresAt).toBeNull();
      expect(result.model.expiresAt).toBeNull();
    });

    it('throws when agencyId or secret is missing', async () => {
      await expect(
        generateTenantToken({ agencyId: '' }, TEST_SECRET)
      ).rejects.toThrow('agencyId is required');

      await expect(
        generateTenantToken({ agencyId: 'agy_test' }, '')
      ).rejects.toThrow('signing secret is required');
    });
  });

  describe('verifyTenantTokenSignature', () => {
    it('successfully verifies a freshly generated token', async () => {
      const { token } = await generateTenantToken(
        {
          agencyId: 'agy_valid_org',
          name: 'Production Token',
          permissions: ['campaign:read', 'campaign:write'],
          expiresInSeconds: 7200,
        },
        TEST_SECRET
      );

      const verification = await verifyTenantTokenSignature(token, TEST_SECRET);
      expect(verification.valid).toBe(true);
      expect(verification.payload?.agencyId).toBe('agy_valid_org');
      expect(verification.payload?.permissions).toEqual(['campaign:read', 'campaign:write']);
    });

    it('rejects token signed with a different secret', async () => {
      const { token } = await generateTenantToken(
        { agencyId: 'agy_forged' },
        TEST_SECRET
      );

      const verification = await verifyTenantTokenSignature(token, OTHER_SECRET);
      expect(verification.valid).toBe(false);
      expect(verification.errorCode).toBe('INVALID_SIGNATURE');
    });

    it('rejects token when signature is altered', async () => {
      const { token } = await generateTenantToken(
        { agencyId: 'agy_tampered_sig' },
        TEST_SECRET
      );

      // Flip the last character of the signature
      const lastChar = token.slice(-1);
      const replacementChar = lastChar === 'a' ? 'b' : 'a';
      const tamperedToken = token.slice(0, -1) + replacementChar;

      const verification = await verifyTenantTokenSignature(tamperedToken, TEST_SECRET);
      expect(verification.valid).toBe(false);
      expect(verification.errorCode).toBe('INVALID_SIGNATURE');
    });

    it('rejects token when payload body is modified', async () => {
      const { token } = await generateTenantToken(
        { agencyId: 'agy_victim' },
        TEST_SECRET
      );

      const parts = token.slice('agy_tok_'.length).split('.');
      // Forge a new base64 payload targeting a different agency
      const forgedPayload = btoa(JSON.stringify({ agencyId: 'agy_attacker', permissions: ['*'] }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const forgedToken = `agy_tok_${forgedPayload}.${parts[1]}`;

      const verification = await verifyTenantTokenSignature(forgedToken, TEST_SECRET);
      expect(verification.valid).toBe(false);
      expect(verification.errorCode).toBe('INVALID_SIGNATURE');
    });

    it('identifies expired tokens', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const { token } = await generateTenantToken(
        {
          agencyId: 'agy_expired',
          expiresInSeconds: 10,
        },
        TEST_SECRET
      );

      // Check with future time
      const verification = await verifyTenantTokenSignature(token, TEST_SECRET, nowSec + 100);
      expect(verification.valid).toBe(false);
      expect(verification.errorCode).toBe('EXPIRED');
      expect(verification.payload?.agencyId).toBe('agy_expired');
    });

    it('rejects malformed strings and missing prefixes', async () => {
      expect((await verifyTenantTokenSignature(null, TEST_SECRET)).errorCode).toBe('INVALID_FORMAT');
      expect((await verifyTenantTokenSignature('', TEST_SECRET)).errorCode).toBe('INVALID_FORMAT');
      expect((await verifyTenantTokenSignature('invalid_prefix_abc.def', TEST_SECRET)).errorCode).toBe('INVALID_FORMAT');
      expect((await verifyTenantTokenSignature('agy_tok_nopartshere', TEST_SECRET)).errorCode).toBe('INVALID_FORMAT');
      expect((await verifyTenantTokenSignature('agy_tok_too.many.parts.here', TEST_SECRET)).errorCode).toBe('INVALID_FORMAT');
    });
  });

  describe('validateTokenPermissions', () => {
    it('matches exact permissions', () => {
      expect(validateTokenPermissions(['read', 'write'], 'read')).toBe(true);
      expect(validateTokenPermissions(['read', 'write'], 'write')).toBe(true);
      expect(validateTokenPermissions(['read', 'write'], 'delete')).toBe(false);
    });

    it('allows all permissions with wildcard or admin', () => {
      expect(validateTokenPermissions(['*'], 'video:delete')).toBe(true);
      expect(validateTokenPermissions(['admin'], 'billing:manage')).toBe(true);
    });

    it('matches namespace wildcards correctly', () => {
      expect(validateTokenPermissions(['video:*'], 'video:create')).toBe(true);
      expect(validateTokenPermissions(['video:*'], 'video:render')).toBe(true);
      expect(validateTokenPermissions(['video:*'], 'billing:charge')).toBe(false);
    });

    it('handles empty or missing permissions gracefully', () => {
      expect(validateTokenPermissions([], 'read')).toBe(false);
      expect(validateTokenPermissions(null, 'read')).toBe(false);
      expect(validateTokenPermissions(['read'], '')).toBe(true);
    });
  });

  describe('hashTenantToken', () => {
    it('produces deterministic 64-character SHA-256 hex string', async () => {
      const hash1 = await hashTenantToken('sample_token_string_123');
      const hash2 = await hashTenantToken('sample_token_string_123');
      const hash3 = await hashTenantToken('different_token_string');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).not.toBe(hash3);
    });
  });
});
