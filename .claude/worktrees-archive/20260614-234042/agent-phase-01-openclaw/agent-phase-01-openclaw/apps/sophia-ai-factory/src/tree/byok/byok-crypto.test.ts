/**
 * Tests for byok-crypto — Phase 4G-BYOK.
 *
 * Covers:
 *   - encrypt→decrypt round-trip
 *   - tamper detection via AES-GCM auth tag
 *   - missing / malformed master key errors
 *   - different plaintexts → different ciphertexts (IV randomness)
 *   - generateMasterKey produces valid 32-byte base64
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  encryptApiKey,
  decryptApiKey,
  generateMasterKey,
  ByokMissingMasterKeyError,
  ByokInvalidMasterKeyError,
} from '@/tree/byok/byok-crypto'

// 32 bytes of `0x42` base64-encoded (well-known test key, never prod).
const TEST_MASTER_KEY = 'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI='

describe('byok-crypto', () => {
  beforeEach(() => {
    delete process.env.BYOK_MASTER_KEY
  })

  describe('master key errors', () => {
    it('throws ByokMissingMasterKeyError when BYOK_MASTER_KEY unset', async () => {
      await expect(encryptApiKey('sk-test')).rejects.toBeInstanceOf(ByokMissingMasterKeyError)
    })

    it('throws ByokInvalidMasterKeyError on non-base64 value', async () => {
      process.env.BYOK_MASTER_KEY = '!!!not-base64!!!'
      await expect(encryptApiKey('sk-test')).rejects.toBeInstanceOf(ByokInvalidMasterKeyError)
    })

    it('throws ByokInvalidMasterKeyError on wrong-length key (16 bytes)', async () => {
      // 16 bytes of zeros, base64 = "AAAAAAAAAAAAAAAAAAAAAA=="
      process.env.BYOK_MASTER_KEY = 'AAAAAAAAAAAAAAAAAAAAAA=='
      await expect(encryptApiKey('sk-test')).rejects.toBeInstanceOf(ByokInvalidMasterKeyError)
    })
  })

  describe('encrypt/decrypt round-trip', () => {
    beforeEach(() => {
      process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY
    })

    it('decrypts to original plaintext', async () => {
      const plain = 'sk-or-v1-1234567890abcdef'
      const blob  = await encryptApiKey(plain)
      const back  = await decryptApiKey(blob)
      expect(back).toBe(plain)
    })

    it('handles unicode plaintext losslessly', async () => {
      const plain = 'sk-📡 émoji and açcénts €'
      const blob  = await encryptApiKey(plain)
      const back  = await decryptApiKey(blob)
      expect(back).toBe(plain)
    })

    it('produces different ciphertext for same plaintext (IV randomness)', async () => {
      const plain = 'sk-ant-test'
      const a = await encryptApiKey(plain)
      const b = await encryptApiKey(plain)
      // Same plaintext, different IVs → different blobs
      expect(Array.from(a)).not.toEqual(Array.from(b))
      // But both decrypt back to the same plaintext
      expect(await decryptApiKey(a)).toBe(plain)
      expect(await decryptApiKey(b)).toBe(plain)
    })

    it('rejects empty plaintext on encrypt', async () => {
      await expect(encryptApiKey('')).rejects.toThrow('BYOK_ENCRYPT_EMPTY')
    })
  })

  describe('tamper detection', () => {
    beforeEach(() => {
      process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY
    })

    it('decryption throws on auth-tag failure (flipped byte)', async () => {
      const blob = await encryptApiKey('sk-test-key')
      // Flip the last byte of the ciphertext (auth tag section)
      const tampered = new Uint8Array(blob)
      tampered[tampered.length - 1] ^= 0x01
      await expect(decryptApiKey(tampered)).rejects.toBeDefined()
    })

    it('decryption throws on flipped IV byte', async () => {
      const blob = await encryptApiKey('sk-test-key')
      const tampered = new Uint8Array(blob)
      tampered[0] ^= 0x01
      await expect(decryptApiKey(tampered)).rejects.toBeDefined()
    })

    it('decryption throws on too-short payload', async () => {
      const tiny = new Uint8Array(4)
      await expect(decryptApiKey(tiny)).rejects.toThrow('BYOK_DECRYPT_MALFORMED')
    })

    it('decryption throws when master key rotates mid-flight', async () => {
      const blob = await encryptApiKey('sk-test-key')
      // Rotate master key — existing blob must refuse to decrypt.
      process.env.BYOK_MASTER_KEY = 'Q0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ0M='
      await expect(decryptApiKey(blob)).rejects.toBeDefined()
    })
  })

  describe('generateMasterKey', () => {
    it('returns a 32-byte base64 string', async () => {
      const k = await generateMasterKey()
      // base64 of 32 bytes = 44 chars (with padding)
      expect(k.length).toBe(44)
      // Importable as AES-256 key: set + encrypt should succeed
      process.env.BYOK_MASTER_KEY = k
      await expect(encryptApiKey('test')).resolves.toBeInstanceOf(Uint8Array)
    })

    it('produces a different key each call', async () => {
      const a = await generateMasterKey()
      const b = await generateMasterKey()
      expect(a).not.toBe(b)
    })
  })
})
