import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptToken, decryptToken, reEncryptToken } from '../token-crypto';

describe('Token Crypto Utilities', () => {
  const originalEnv = { ...process.env };

  const keyCurrent = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const keyPrevious = '09f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a';

  beforeEach(() => {
    process.env.OAUTH_TOKEN_ENC_KEY = keyCurrent;
    delete process.env.OAUTH_TOKEN_ENC_KEY_PREV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should encrypt and decrypt a token correctly with current key', async () => {
    const rawToken = 'super-secret-oauth-token-12345';
    const encrypted = await encryptToken(rawToken);
    expect(encrypted.startsWith('aes:v1:')).toBe(true);

    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });

  it('should fallback to OAUTH_TOKEN_ENC_KEY_PREV if current key fails', async () => {
    // 1. Encrypt with keyPrevious by setting it as current key temporarily
    process.env.OAUTH_TOKEN_ENC_KEY = keyPrevious;
    const rawToken = 'rotated-secret-token-54321';
    const encryptedWithPrev = await encryptToken(rawToken);

    // 2. Rotate keys: keyCurrent is now the current key, and keyPrevious is the previous key
    process.env.OAUTH_TOKEN_ENC_KEY = keyCurrent;
    process.env.OAUTH_TOKEN_ENC_KEY_PREV = keyPrevious;

    // 3. Decrypt should succeed by falling back to keyPrevious
    const decrypted = await decryptToken(encryptedWithPrev);
    expect(decrypted).toBe(rawToken);
  });

  it('should throw an error if decryption fails with all available keys', async () => {
    // Encrypt with a completely different key
    process.env.OAUTH_TOKEN_ENC_KEY = 'f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706';
    const encryptedWithOther = await encryptToken('some-secret');

    // Restore test keys
    process.env.OAUTH_TOKEN_ENC_KEY = keyCurrent;
    process.env.OAUTH_TOKEN_ENC_KEY_PREV = keyPrevious;

    await expect(decryptToken(encryptedWithOther)).rejects.toThrow(
      'Failed to decrypt token: decryption failed with all available keys'
    );
  });

  it('should fall back to base64 decode if the legacy enc: prefix is used', async () => {
    const rawPlaintext = 'legacy-decrypted-value';
    const validLegacyCipher = 'enc:' + Buffer.from(rawPlaintext).toString('base64');
    const decrypted = await decryptToken(validLegacyCipher);
    expect(decrypted).toBe(rawPlaintext);
  });

  it('should return original text if no encryption prefix matches', async () => {
    const plaintext = 'normal-unencrypted-text';
    const decrypted = await decryptToken(plaintext);
    expect(decrypted).toBe(plaintext);
  });

  it('should return empty string or original falsy value if input is empty', async () => {
    expect(await decryptToken('')).toBe('');
    expect(await encryptToken('')).toBe('');
  });

  it('should re-encrypt a token correctly', async () => {
    const plaintext = 'some-secret';
    const reEncrypted = await reEncryptToken(plaintext);
    expect(await decryptToken(reEncrypted)).toBe(plaintext);
  });
});
