/**
 * @module tree/mekong/__tests__/crypto.test
 *
 * Comprehensive unit test suite for Web Crypto AES-256-GCM & mutual auth primitives.
 */

import { describe, it, expect } from 'vitest';
import {
  bytesToBase64,
  base64ToBytes,
  timingSafeEqual,
  hashAuthToken,
  verifyAuthTokenHash,
  deriveEncryptionKey,
  encryptPayload,
  decryptPayload,
  MekongCryptoError,
  MekongTamperError,
  MekongKeyError,
  MekongPayloadError,
  IV_LENGTH_BYTES,
  KEY_LENGTH_BITS,
} from '../crypto';

describe('tree/mekong/crypto', () => {
  describe('base64 conversions', () => {
    it('roundtrips binary bytes to base64 and back', () => {
      const original = new Uint8Array([0, 1, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
      const b64 = bytesToBase64(original);
      const decoded = base64ToBytes(b64);
      expect(decoded).toEqual(original);
    });

    it('throws MekongPayloadError on invalid base64 input', () => {
      expect(() => base64ToBytes('not-valid-base64!!@@##')).toThrow(MekongPayloadError);
    });
  });

  describe('timingSafeEqual', () => {
    it('returns true for identical strings', () => {
      expect(timingSafeEqual('abcdef123456', 'abcdef123456')).toBe(true);
      expect(timingSafeEqual('hash_token_abc', 'hash_token_abc')).toBe(true);
    });

    it('returns false for strings of the same length with different characters', () => {
      expect(timingSafeEqual('abcdef123456', 'abcdef123457')).toBe(false);
      expect(timingSafeEqual('token_alpha', 'token_beta_')).toBe(false);
    });

    it('returns false for strings of different lengths', () => {
      expect(timingSafeEqual('abc', 'abcd')).toBe(false);
      expect(timingSafeEqual('short', 'much_longer_string')).toBe(false);
    });

    it('returns false for null, undefined, or empty strings', () => {
      expect(timingSafeEqual(null, 'abc')).toBe(false);
      expect(timingSafeEqual('abc', undefined)).toBe(false);
      expect(timingSafeEqual('', '')).toBe(false);
    });
  });

  describe('hashAuthToken and verifyAuthTokenHash', () => {
    it('computes 64-character lowercase hexadecimal SHA-256 digest', async () => {
      const token = 'mekong_secret_token_12345';
      const hash = await hashAuthToken(token);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('throws MekongKeyError on empty or invalid token', async () => {
      await expect(hashAuthToken('')).rejects.toThrow(MekongKeyError);
      // @ts-expect-error testing invalid type
      await expect(hashAuthToken(null)).rejects.toThrow(MekongKeyError);
    });

    it('verifies valid token hash in constant-time', async () => {
      const token = 'bearer_secret_xyz';
      const hash = await hashAuthToken(token);

      const isValid = await verifyAuthTokenHash(token, hash);
      expect(isValid).toBe(true);
    });

    it('verifies valid token hash with sha256= prefix', async () => {
      const token = 'bearer_secret_xyz';
      const hash = await hashAuthToken(token);

      const isValid = await verifyAuthTokenHash(token, `sha256=${hash}`);
      expect(isValid).toBe(true);
    });

    it('rejects mismatched token or tampered hash', async () => {
      const token = 'bearer_secret_xyz';
      const hash = await hashAuthToken(token);

      const tamperedHash = hash.replace(/^./, hash[0] === 'a' ? 'b' : 'a');
      expect(await verifyAuthTokenHash(token, tamperedHash)).toBe(false);
      expect(await verifyAuthTokenHash('wrong_token', hash)).toBe(false);
    });

    it('rejects empty or non-string inputs safely', async () => {
      expect(await verifyAuthTokenHash('', 'somehash')).toBe(false);
      expect(await verifyAuthTokenHash('token', '')).toBe(false);
    });
  });

  describe('deriveEncryptionKey', () => {
    it('derives an AES-GCM 256-bit CryptoKey from string secret', async () => {
      const key = await deriveEncryptionKey('my-secure-cluster-secret');
      expect(key.algorithm.name).toBe('AES-GCM');
      // @ts-expect-error checking CryptoKey length
      expect(key.algorithm.length).toBe(KEY_LENGTH_BITS);
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('throws MekongKeyError on invalid secret', async () => {
      await expect(deriveEncryptionKey('')).rejects.toThrow(MekongKeyError);
    });
  });

  describe('AES-256-GCM Payload Encryption & Decryption', () => {
    const secret = 'shared-tunnel-token-secret-for-m1-max';

    it('roundtrips a complex JSON inference task payload', async () => {
      const payload = {
        taskId: 'task_001',
        type: 'llm',
        prompt: 'Generate viral hooks for autonomous growth',
        model: 'qwen3:32b',
        maxTokens: 1024,
        metadata: {
          tenantId: 'tenant_abc',
          tier: 'SCALE',
          features: ['occ_cas', 'aes_gcm'],
        },
      };

      const envelope = await encryptPayload(payload, secret);
      expect(envelope.version).toBe('v1');
      expect(envelope.algorithm).toBe('AES-256-GCM');
      expect(typeof envelope.iv).toBe('string');
      expect(typeof envelope.ciphertext).toBe('string');
      expect(envelope.timestamp).toBeGreaterThan(0);

      const ivBytes = base64ToBytes(envelope.iv);
      expect(ivBytes).toHaveLength(IV_LENGTH_BYTES);

      const decrypted = await decryptPayload<typeof payload>(envelope, secret);
      expect(decrypted).toEqual(payload);
    });

    it('handles unicode, emojis, and multilingual characters seamlessly', async () => {
      const payload = {
        message: 'Hệ thống Mekong AI Hybrid Edge Node với GPU M1 Max 🚀 siêu tốc',
        tokens: ['🇻🇳', '⚡', '🤖'],
      };

      const envelope = await encryptPayload(payload, secret);
      const decrypted = await decryptPayload<typeof payload>(envelope, secret);
      expect(decrypted).toEqual(payload);
    });

    it('generates a fresh random IV per encryption (semantic security)', async () => {
      const data = { test: 'deterministic_content' };

      const envelope1 = await encryptPayload(data, secret);
      const envelope2 = await encryptPayload(data, secret);

      expect(envelope1.iv).not.toEqual(envelope2.iv);
      expect(envelope1.ciphertext).not.toEqual(envelope2.ciphertext);

      const decrypted1 = await decryptPayload(envelope1, secret);
      const decrypted2 = await decryptPayload(envelope2, secret);
      expect(decrypted1).toEqual(data);
      expect(decrypted2).toEqual(data);
    });

    it('detects tampering and throws MekongTamperError on ciphertext modification', async () => {
      const payload = { sensitive: 'tenant-byok-api-key-sk-123456' };
      const envelope = await encryptPayload(payload, secret);

      // Flip one character in ciphertext
      const originalB64 = envelope.ciphertext;
      const tamperedB64 =
        originalB64.slice(0, 10) +
        (originalB64[10] === 'A' ? 'B' : 'A') +
        originalB64.slice(11);

      const tamperedEnvelope = { ...envelope, ciphertext: tamperedB64 };

      await expect(decryptPayload(tamperedEnvelope, secret)).rejects.toThrow(MekongTamperError);
    });

    it('detects tampering and throws MekongTamperError on IV modification', async () => {
      const payload = { sensitive: 'prompt_text' };
      const envelope = await encryptPayload(payload, secret);

      // Alter IV
      const originalIv = envelope.iv;
      const tamperedIv =
        originalIv.slice(0, 4) +
        (originalIv[4] === 'x' ? 'y' : 'x') +
        originalIv.slice(5);

      const tamperedEnvelope = { ...envelope, iv: tamperedIv };

      await expect(decryptPayload(tamperedEnvelope, secret)).rejects.toThrow(MekongTamperError);
    });

    it('rejects decryption when using the wrong key or token', async () => {
      const payload = { balance: 1000000 };
      const envelope = await encryptPayload(payload, secret);

      await expect(decryptPayload(envelope, 'wrong-secret-token')).rejects.toThrow(
        MekongTamperError,
      );
    });

    it('throws MekongPayloadError on missing or invalid envelope attributes', async () => {
      // @ts-expect-error invalid envelope
      await expect(decryptPayload(null, secret)).rejects.toThrow(MekongPayloadError);

      // @ts-expect-error unsupported algorithm
      await expect(decryptPayload({ algorithm: 'DES' }, secret)).rejects.toThrow(
        MekongPayloadError,
      );

      // Invalid IV length (e.g. 6 bytes instead of 12)
      const invalidIvEnvelope = {
        version: 'v1' as const,
        algorithm: 'AES-256-GCM' as const,
        iv: bytesToBase64(new Uint8Array(6)),
        ciphertext: bytesToBase64(new Uint8Array(32)),
        timestamp: Date.now(),
      };
      await expect(decryptPayload(invalidIvEnvelope, secret)).rejects.toThrow(
        MekongPayloadError,
      );
    });

    it('throws MekongPayloadError when encrypting undefined data', async () => {
      await expect(encryptPayload(undefined, secret)).rejects.toThrow(MekongPayloadError);
    });
  });
});
