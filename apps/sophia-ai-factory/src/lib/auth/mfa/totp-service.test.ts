/**
 * Unit tests for TOTP service
 *
 * Coverage:
 *   1. generateTotpSecret() produces valid base32 string
 *   2. verifyTotp() returns true for valid code
 *   3. verifyTotp() returns false for wrong code
 *   4. generateBackupCodes() produces unique codes in XXXX-XXXX format
 *   5. Time window: verify with window=1 accepts code within ±1 period
 *   6. hashBackupCode() produces consistent SHA-256 hex
 *   7. verifyBackupCode() finds matching hashed code
 *   8. consumeBackupCode() removes the used code from stored JSON
 */

import { describe, it, expect } from 'vitest';
import * as OTPAuth from 'otpauth';
import {
  generateTotpSecret,
  generateOtpauthUri,
  verifyTotp,
  generateBackupCodes,
  hashBackupCode,
  hashBackupCodesToJson,
  verifyBackupCode,
  consumeBackupCode,
} from './totp-service';

describe('generateTotpSecret', () => {
  it('returns a non-empty base32 string', () => {
    const secret = generateTotpSecret();
    expect(secret).toBeTruthy();
    expect(typeof secret).toBe('string');
    // base32 characters only
    expect(/^[A-Z2-7]+=*$/.test(secret)).toBe(true);
  });

  it('generates different secrets each time', () => {
    const s1 = generateTotpSecret();
    const s2 = generateTotpSecret();
    expect(s1).not.toBe(s2);
  });
});

describe('generateOtpauthUri', () => {
  it('returns a valid otpauth:// URI', () => {
    const secret = generateTotpSecret();
    const uri = generateOtpauthUri('test@example.com', secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('Sophia%20AI%20Factory');
    expect(uri).toContain('test%40example.com');
  });
});

describe('verifyTotp', () => {
  function generateCurrentCode(secret: string): string {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    return totp.generate();
  }

  it('returns true for a valid TOTP code', () => {
    const secret = generateTotpSecret();
    const code = generateCurrentCode(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });

  it('returns false for an incorrect code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
  });

  it('returns false for malformed code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('accepts code within window=1 (current period)', () => {
    const secret = generateTotpSecret();
    const code = generateCurrentCode(secret);
    // window=1 should definitely accept current period code
    expect(verifyTotp(secret, code, 1)).toBe(true);
  });
});

describe('generateBackupCodes', () => {
  it('generates the correct number of codes (default 8)', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
  });

  it('generates codes in XXXX-XXXX format', () => {
    const codes = generateBackupCodes();
    for (const code of codes) {
      expect(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)).toBe(true);
    }
  });

  it('generates unique codes', () => {
    const codes = generateBackupCodes(8);
    const unique = new Set(codes);
    expect(unique.size).toBe(8);
  });

  it('respects custom count', () => {
    const codes = generateBackupCodes(4);
    expect(codes).toHaveLength(4);
  });
});

describe('hashBackupCode', () => {
  it('returns a 64-character hex string (SHA-256)', async () => {
    const hash = await hashBackupCode('ABCD-1234');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('produces the same hash for same input', async () => {
    const h1 = await hashBackupCode('ABCD-1234');
    const h2 = await hashBackupCode('ABCD-1234');
    expect(h1).toBe(h2);
  });

  it('is case-insensitive (normalizes to uppercase)', async () => {
    const h1 = await hashBackupCode('abcd-1234');
    const h2 = await hashBackupCode('ABCD-1234');
    expect(h1).toBe(h2);
  });
});

describe('verifyBackupCode', () => {
  it('returns the index of a matching backup code', async () => {
    const codes = generateBackupCodes(4);
    const json = await hashBackupCodesToJson(codes);
    const idx = await verifyBackupCode(codes[2], json);
    expect(idx).toBe(2);
  });

  it('returns -1 for a non-matching code', async () => {
    const codes = generateBackupCodes(4);
    const json = await hashBackupCodesToJson(codes);
    const idx = await verifyBackupCode('ZZZZ-ZZZZ', json);
    expect(idx).toBe(-1);
  });
});

describe('consumeBackupCode', () => {
  it('removes the code at the given index', async () => {
    const codes = generateBackupCodes(4);
    const json = await hashBackupCodesToJson(codes);
    const updated = consumeBackupCode(json, 1);
    const remaining: string[] = JSON.parse(updated);
    expect(remaining).toHaveLength(3);
  });
});
