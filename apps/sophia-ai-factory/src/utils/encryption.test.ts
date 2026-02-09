import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encrypt, decrypt, maskApiKey } from './encryption';

describe('Encryption Utils', () => {
  beforeEach(() => {
    // Set a valid 32-byte hex key for testing
    vi.stubEnv('API_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should encrypt and decrypt a string correctly', () => {
    const text = 'sk-1234567890abcdef';
    const encrypted = encrypt(text);

    expect(encrypted).not.toBe(text);
    expect(encrypted).toContain(':'); // Should have IV and AuthTag parts

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it('should generate different ciphertexts for the same plaintext (random IV)', () => {
    const text = 'secret-message';
    const enc1 = encrypt(text);
    const enc2 = encrypt(text);

    expect(enc1).not.toBe(enc2);
    expect(decrypt(enc1)).toBe(text);
    expect(decrypt(enc2)).toBe(text);
  });

  it('should throw error if API_ENCRYPTION_KEY is missing', () => {
    vi.stubEnv('API_ENCRYPTION_KEY', '');
    expect(() => encrypt('test')).toThrow('Encryption key not configured');
    expect(() => decrypt('test')).toThrow('Encryption key not configured');
  });

  it('should mask API keys correctly', () => {
    expect(maskApiKey('sk-1234567890abcdef', 4)).toBe('sk-...cdef');
    expect(maskApiKey('short', 4)).toBe('********');
    expect(maskApiKey('', 4)).toBe('********');
    expect(maskApiKey(undefined as unknown as string, 4)).toBe('********');
  });
});
