/**
 * Unit tests for PBKDF2 password hashing & constant-time verification.
 * Layer: seed/security
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password-hash';

describe('seed/security/password-hash', () => {
  describe('hashPassword', () => {
    it('produces a valid pbkdf2 format string with salt and hash', async () => {
      const password = 'CorrectHorseBatteryStaple123!';
      const hash = await hashPassword(password);

      expect(hash).toMatch(/^pbkdf2:[0-9a-fA-F]{32}:[0-9a-fA-F]{64}$/);
    });

    it('generates unique salts across multiple hashes of identical passwords', async () => {
      const password = 'IdenticalPassword456$';
      const [hash1, hash2] = await Promise.all([
        hashPassword(password),
        hashPassword(password),
      ]);

      expect(hash1).not.toBe(hash2);
      const [, salt1] = hash1.split(':');
      const [, salt2] = hash2.split(':');
      expect(salt1).not.toBe(salt2);
    });

    it('throws when password is empty or not a string', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string');
      // @ts-expect-error testing invalid input runtime guard
      await expect(hashPassword(null)).rejects.toThrow('Password must be a non-empty string');
      // @ts-expect-error testing invalid input runtime guard
      await expect(hashPassword(undefined)).rejects.toThrow('Password must be a non-empty string');
    });
  });

  describe('verifyPassword', () => {
    it('returns true when password matches hash', async () => {
      const password = 'SuperSecretSafePassword789#';
      const stored = await hashPassword(password);

      const isValid = await verifyPassword(password, stored);
      expect(isValid).toBe(true);
    });

    it('returns false when password does not match hash', async () => {
      const password = 'CorrectPassword';
      const stored = await hashPassword(password);

      const isValid = await verifyPassword('WrongPassword', stored);
      expect(isValid).toBe(false);
    });

    it('fails closed (returns false) on empty or non-string password/stored inputs', async () => {
      const validStored = await hashPassword('TestPassword123');

      expect(await verifyPassword('', validStored)).toBe(false);
      // @ts-expect-error invalid runtime inputs
      expect(await verifyPassword(null, validStored)).toBe(false);
      // @ts-expect-error invalid runtime inputs
      expect(await verifyPassword(undefined, validStored)).toBe(false);
      expect(await verifyPassword('TestPassword123', '')).toBe(false);
      // @ts-expect-error invalid runtime inputs
      expect(await verifyPassword('TestPassword123', null)).toBe(false);
      // @ts-expect-error invalid runtime inputs
      expect(await verifyPassword('TestPassword123', undefined)).toBe(false);
    });

    it('fails closed (returns false) on malformed stored hash strings without crashing', async () => {
      const pwd = 'TestPassword123';

      expect(await verifyPassword(pwd, 'not-a-valid-hash')).toBe(false);
      expect(await verifyPassword(pwd, 'argon2:abc:def')).toBe(false);
      expect(await verifyPassword(pwd, 'pbkdf2:onlyonesalt')).toBe(false);
      expect(await verifyPassword(pwd, 'pbkdf2::')).toBe(false);
      // odd-length salt or hash
      expect(await verifyPassword(pwd, 'pbkdf2:123:456')).toBe(false);
      expect(await verifyPassword(pwd, 'pbkdf2:12:456')).toBe(false);
      // non-hex characters
      expect(await verifyPassword(pwd, 'pbkdf2:zzzz:1234')).toBe(false);
      expect(await verifyPassword(pwd, 'pbkdf2:1234:zzzz')).toBe(false);
    });
  });
});
