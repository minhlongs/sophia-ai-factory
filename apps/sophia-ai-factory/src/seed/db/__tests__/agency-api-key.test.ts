import { generateAgencyApiKey, hashApiKey, verifyApiKey, type AgencyApiKey, createAgencyApiKey } from '../agency-api-key';
import { describe, it, expect } from 'vitest'

describe('Agency API Key Generator', () => {
  describe('generateAgencyApiKey', () => {
    it('returns a 43-character base64url string', () => {
      const key = generateAgencyApiKey();
      expect(key).toHaveLength(43);
    });

    it('generates keys matching base64url alphabet only', () => {
      const key = generateAgencyApiKey();
      expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates unique keys on repeated calls', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(generateAgencyApiKey());
      }
      expect(keys.size).toBe(100);
    });

    it('never returns an empty string', () => {
      for (let i = 0; i < 10; i++) {
        expect(generateAgencyApiKey().length).toBeGreaterThan(0);
      }
    });
  });

  describe('hashApiKey', () => {
    it('returns a non-empty hash string', async () => {
      const hash = await hashApiKey('test-key-plaintext');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('hash is different from plaintext input', async () => {
      const hash = await hashApiKey('some-api-key');
      expect(hash).not.toBe('some-api-key');
    });

    it('produces consistent hash for same input', async () => {
      const hash1 = await hashApiKey('consistent-key');
      const hash2 = await hashApiKey('consistent-key');
      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyApiKey', () => {
    it('returns true for a valid key matching the hash', async () => {
      const key = 'test-key-to-verify-12345';
      const hash = await hashApiKey(key);
      const result = await verifyApiKey(key, hash);
      expect(result).toBe(true);
    });

    it('returns false for an invalid key against a valid hash', async () => {
      const validKey = 'correct-key';
      const hash = await hashApiKey(validKey);
      const result = await verifyApiKey('wrong-key', hash);
      expect(result).toBe(false);
    });

    it('returns false for empty plaintext against any hash', async () => {
      const hash = await hashApiKey('some-key');
      const result = await verifyApiKey('', hash);
      expect(result).toBe(false);
    });
  });

  describe('createAgencyApiKey', () => {
    it('returns a key pair with matching length key and non-empty hash', async () => {
      const pair = await createAgencyApiKey();
      expect(pair.key).toHaveLength(43);
      expect(pair.hash.length).toBeGreaterThan(0);
      expect(pair.hash).not.toBe(pair.key);
    });
  });

  describe('type contract', () => {
    it('AgencyApiKey type has string key and string hash', () => {
      const pair: AgencyApiKey = { key: 'abc', hash: 'def' };
      expect(pair.key).toBe('abc');
      expect(pair.hash).toBe('def');
    });
  });
});
