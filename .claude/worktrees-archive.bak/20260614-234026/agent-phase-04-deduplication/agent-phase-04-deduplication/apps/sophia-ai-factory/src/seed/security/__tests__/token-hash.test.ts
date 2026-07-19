/**
 * Tests for token-hash utility (Wave 22 Phase 01).
 */

import { describe, it, expect } from 'vitest';
import { sha256Hex, safeCompareHex, isHashedToken } from '../token-hash';

describe('sha256Hex', () => {
  it('produces deterministic 64-char hex output', async () => {
    const out = await sha256Hex('abc');
    expect(out).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(out.length).toBe(64);
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the same hash for identical inputs', async () => {
    const a = await sha256Hex('token-xyz');
    const b = await sha256Hex('token-xyz');
    expect(a).toBe(b);
  });

  it('returns different hashes for different inputs', async () => {
    const a = await sha256Hex('token-1');
    const b = await sha256Hex('token-2');
    expect(a).not.toBe(b);
  });

  it('handles UUID input shape', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const out = await sha256Hex(uuid);
    expect(out.length).toBe(64);
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('safeCompareHex', () => {
  it('returns true for equal strings', () => {
    expect(safeCompareHex('abc123', 'abc123')).toBe(true);
  });

  it('returns false for unequal same-length strings', () => {
    expect(safeCompareHex('abc123', 'abc124')).toBe(false);
  });

  it('returns false for length mismatch', () => {
    expect(safeCompareHex('abc', 'abcd')).toBe(false);
    expect(safeCompareHex('', 'a')).toBe(false);
  });

  it('handles empty strings', () => {
    expect(safeCompareHex('', '')).toBe(true);
  });
});

describe('isHashedToken', () => {
  it('recognizes 64-char sha256 hex digest', () => {
    const sha = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(isHashedToken(sha)).toBe(true);
  });

  it('rejects UUID v4 format (legacy plaintext)', () => {
    expect(isHashedToken('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isHashedToken('')).toBe(false);
  });

  it('rejects 64-char string with non-hex chars', () => {
    expect(isHashedToken('Z'.repeat(64))).toBe(false);
  });
});
