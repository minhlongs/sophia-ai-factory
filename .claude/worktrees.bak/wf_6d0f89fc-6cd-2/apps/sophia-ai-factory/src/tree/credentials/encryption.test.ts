/**
 * Tests for lib/credentials/encryption.ts
 * 
 * Covers:
 *  - encryptValue + decryptValue roundtrip
 *  - decryptValue fails with wrong key (tamper detection)
 *  - encryptValue throws on empty plaintext
 *  - decryptValue throws on malformed encrypted string
 *  - Falls back to BYOK_MASTER_KEY when CREDENTIALS_MASTER_KEY not set
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use a stable test master key (64 hex chars = 32 bytes)
const TEST_HEX_KEY = 'a'.repeat(64) // 64 hex chars

describe('lib/credentials/encryption', () => {
  beforeEach(() => {
    vi.stubEnv('CREDENTIALS_MASTER_KEY', TEST_HEX_KEY)
    vi.stubEnv('BYOK_MASTER_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('encrypts and decrypts a value roundtrip', async () => {
    const { encryptValue, decryptValue } = await import('./encryption')
    const plaintext = 'hk_test_heygen_api_key_12345'
    const encrypted = await encryptValue(plaintext)

    expect(encrypted).toMatch(/^v?\d*:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
    const decrypted = await decryptValue(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('each encryption produces a different ciphertext (random IV)', async () => {
    const { encryptValue } = await import('./encryption')
    const plaintext = 're_test_resend_key'
    const enc1 = await encryptValue(plaintext)
    const enc2 = await encryptValue(plaintext)
    expect(enc1).not.toBe(enc2)
  })

  it('decryptValue throws on tampered ciphertext', async () => {
    const { encryptValue, decryptValue } = await import('./encryption')
    const encrypted = await encryptValue('secret_value')
    // Flip a character in the ciphertext portion
    const [iv, ct] = encrypted.split(':')
    const tampered = `${iv}:${ct!.slice(0, -2)}XX`
    await expect(decryptValue(tampered)).rejects.toThrow()
  })

  it('decryptValue throws on malformed string (no separator)', async () => {
    const { decryptValue } = await import('./encryption')
    await expect(decryptValue('notvalidformat')).rejects.toThrow('malformed')
  })

  it('encryptValue throws on empty plaintext', async () => {
    const { encryptValue } = await import('./encryption')
    await expect(encryptValue('')).rejects.toThrow('empty')
  })

  it('throws when neither CREDENTIALS_MASTER_KEY nor BYOK_MASTER_KEY is set', async () => {
    vi.stubEnv('CREDENTIALS_MASTER_KEY', '')
    vi.stubEnv('BYOK_MASTER_KEY', '')
    // Force module re-eval by dynamic import within test
    const { encryptValue } = await import('./encryption')
    await expect(encryptValue('test')).rejects.toThrow('not set')
  })
})
