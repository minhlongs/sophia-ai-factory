/**
 * Tests for D1 Secret Encryption Helper (encrypt-secret.ts)
 *
 * Verifies:
 *   1. Roundtrip — encrypt then decrypt returns original plaintext
 *   2. Each encryption uses a fresh IV (ciphertexts differ for same plaintext)
 *   3. Tamper detection — flipping a byte → decrypt throws
 *   4. Wrong key — decrypt with different DEK → throws
 *   5. Malformed input (too short blob) → throws
 *   6. Missing DEK env var → throws on first call
 *   7. Wrong DEK length → throws
 *   8. Unicode plaintext roundtrips correctly
 */

import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret } from './encrypt-secret'

// 32 random bytes → base64. Distinct DEKs for happy path vs wrong-key tests.
const DEK_A = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='   // all zero
const DEK_B = 'BgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY='   // all 0x06
const DEK_TOO_SHORT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='        // 24 bytes

describe('encryptSecret + decryptSecret', () => {
  it('roundtrips a short ASCII secret', async () => {
    const blob = await encryptSecret('hello world', DEK_A)
    const back = await decryptSecret(blob, DEK_A)
    expect(back).toBe('hello world')
  })

  it('produces distinct ciphertexts for the same plaintext (fresh IV)', async () => {
    const a = await encryptSecret('same', DEK_A)
    const b = await encryptSecret('same', DEK_A)
    expect(a).not.toBe(b)
    expect(await decryptSecret(a, DEK_A)).toBe('same')
    expect(await decryptSecret(b, DEK_A)).toBe('same')
  })

  it('throws when ciphertext is tampered', async () => {
    const blob = await encryptSecret('do-not-tamper', DEK_A)
    // Flip a byte in the middle of the base64-decoded body
    const bytes = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0))
    bytes[20] = bytes[20] ^ 0xff
    const tampered = btoa(String.fromCharCode(...bytes))
    await expect(decryptSecret(tampered, DEK_A)).rejects.toBeDefined()
  })

  it('throws when decrypted with the wrong DEK', async () => {
    const blob = await encryptSecret('cross-key-payload', DEK_A)
    await expect(decryptSecret(blob, DEK_B)).rejects.toBeDefined()
  })

  it('throws on a blob shorter than the IV', async () => {
    await expect(decryptSecret('AAAA', DEK_A)).rejects.toThrow(/too short/i)
  })

  it('throws when LOCAL_MODE_DEK is not configured', async () => {
    const prior = process.env.LOCAL_MODE_DEK
    delete process.env.LOCAL_MODE_DEK
    try {
      await expect(encryptSecret('x')).rejects.toThrow(/LOCAL_MODE_DEK not configured/)
    } finally {
      if (prior !== undefined) process.env.LOCAL_MODE_DEK = prior
    }
  })

  it('throws when DEK decodes to an unexpected length', async () => {
    await expect(encryptSecret('x', DEK_TOO_SHORT)).rejects.toThrow(/must decode to 32 bytes/)
  })

  it('roundtrips unicode (Vietnamese diacritics + emoji)', async () => {
    const text = 'Tiếng Việt có dấu — 🌏 BYOK!'
    const blob = await encryptSecret(text, DEK_A)
    expect(await decryptSecret(blob, DEK_A)).toBe(text)
  })
})
