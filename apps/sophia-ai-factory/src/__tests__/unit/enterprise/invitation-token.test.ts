/**
 * Unit Test Suite: Cryptographic Single-Use Invitation Token Lifecycle
 *
 * Validates:
 * 1. 256-bit CSPRNG token generation (64 hex characters)
 * 2. Deterministic SHA-256 digest calculation & standard test vectors
 * 3. 7-Day TTL calculation
 * 4. Token entropy and non-collision invariant across iterations
 * 5. Expiration checker predicate
 *
 * @module __tests__/unit/enterprise/invitation-token.test
 */

import { describe, it, expect } from 'vitest';
import {
  generateInvitationToken,
  sha256Hex,
  isTokenExpired,
  INVITATION_TTL_MS,
} from '@/seed/security/invitation-token';

describe('Cryptographic Single-Use Invitation Token Generator', () => {
  it('generates a 256-bit CSPRNG token (64 hex chars) and valid SHA-256 hash', async () => {
    const before = Date.now();
    const { rawToken, tokenHash, expiresAt } = await generateInvitationToken();
    const after = Date.now();

    expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);

    // Verify rawToken and tokenHash are distinct (raw token is NOT stored as hash)
    expect(rawToken).not.toBe(tokenHash);

    // Verify hash matches sha256Hex(rawToken)
    const computedHash = await sha256Hex(rawToken);
    expect(tokenHash).toBe(computedHash);

    // Verify 7-day TTL
    expect(expiresAt).toBeGreaterThanOrEqual(before + INVITATION_TTL_MS);
    expect(expiresAt).toBeLessThanOrEqual(after + INVITATION_TTL_MS);
  });

  it('computes accurate SHA-256 hashes matching standard RFC-6234 test vectors', async () => {
    // Empty string SHA-256 standard test vector
    const emptyHash = await sha256Hex('');
    expect(emptyHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    // Known ASCII string test vector
    const abcHash = await sha256Hex('abc');
    expect(abcHash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('ensures high entropy with zero collisions over 100 consecutive generations', async () => {
    const tokens = new Set<string>();
    const hashes = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const { rawToken, tokenHash } = await generateInvitationToken();
      tokens.add(rawToken);
      hashes.add(tokenHash);
    }

    expect(tokens.size).toBe(100);
    expect(hashes.size).toBe(100);
  });

  it('accurately evaluates token expiration status', () => {
    const now = Date.now();
    expect(isTokenExpired(now - 1000, now)).toBe(true);
    expect(isTokenExpired(now + 1000, now)).toBe(false);
    expect(isTokenExpired(now, now)).toBe(false);
  });
});
