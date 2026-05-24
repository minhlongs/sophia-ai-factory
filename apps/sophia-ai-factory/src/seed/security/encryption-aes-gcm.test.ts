import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encrypt, decrypt, maskApiKey } from './encryption-aes-gcm';

describe('Encryption Utils', () => {
  beforeEach(() => {
    // Set a valid 32-byte hex key for testing
    vi.stubEnv('API_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should encrypt and decrypt a string correctly', async () => {
    const text = 'sk-1234567890abcdef';
    const encrypted = await encrypt(text);

    expect(encrypted).not.toBe(text);
    expect(encrypted).toContain(':'); // Should have IV:ciphertext parts

    const decrypted = await decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it('should generate different ciphertexts for the same plaintext (random IV)', async () => {
    const text = 'secret-message';
    const enc1 = await encrypt(text);
    const enc2 = await encrypt(text);

    expect(enc1).not.toBe(enc2);
    expect(await decrypt(enc1)).toBe(text);
    expect(await decrypt(enc2)).toBe(text);
  });

  it('should throw error if API_ENCRYPTION_KEY is missing', async () => {
    vi.stubEnv('API_ENCRYPTION_KEY', '');
    await expect(encrypt('test')).rejects.toThrow('Encryption key not configured');
    await expect(decrypt('test')).rejects.toThrow();
  });

  it('should mask API keys correctly', () => {
    expect(maskApiKey('sk-1234567890abcdef', 4)).toBe('sk-...cdef');
    expect(maskApiKey('short', 4)).toBe('********');
    expect(maskApiKey('', 4)).toBe('********');
    expect(maskApiKey(undefined as unknown as string, 4)).toBe('********');
  });
});
