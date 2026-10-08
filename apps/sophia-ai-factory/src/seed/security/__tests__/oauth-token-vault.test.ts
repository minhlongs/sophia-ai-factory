import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  deriveChannelKey,
  encryptString,
  decryptString,
  encryptTokenVault,
  decryptTokenVault,
  bytesToHex,
  hexToBytes,
  parseVaultEnvelope,
} from '../oauth-token-vault';
import type {
  OAuthTokenPayload,
  VaultDerivationContext,
} from '@/seed/types/social-publisher-types';

describe('OAuth Token Vault (Web Crypto HKDF + AES-256-GCM)', () => {
  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const defaultContext: VaultDerivationContext = {
    userId: 'usr_test_123',
    platform: 'YOUTUBE_SHORTS',
    channelId: 'UC_channel_abc',
  };

  const samplePayload: OAuthTokenPayload = {
    accessToken: 'ya29.a0AfH6SM_test_access_token',
    refreshToken: '1//0g_test_refresh_token',
    expiresAt: Date.now() + 3600 * 1000,
    tokenType: 'Bearer',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
  };

  beforeEach(() => {
    process.env.SOCIAL_VAULT_MASTER_KEY = testSecret;
  });

  afterEach(() => {
    delete process.env.SOCIAL_VAULT_MASTER_KEY;
  });

  it('converts bytes to hex and back accurately', () => {
    const original = new Uint8Array([0, 15, 16, 255, 128, 42]);
    const hex = bytesToHex(original);
    expect(hex).toBe('000f10ff802a');
    const recovered = hexToBytes(hex);
    expect(recovered).toEqual(original);
    expect(() => hexToBytes('abc')).toThrow('odd length');
    expect(() => hexToBytes('zz')).toThrow('Invalid hex');
  });

  it('derives valid CryptoKey for AES-GCM', async () => {
    const key = await deriveChannelKey(testSecret, defaultContext);
    expect(key).toBeDefined();
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('encrypts and decrypts OAuthTokenPayload roundtrip successfully', async () => {
    const envelope = await encryptTokenVault(samplePayload, defaultContext);
    expect(typeof envelope).toBe('string');
    const parts = envelope.split(':');
    expect(parts.length).toBe(3);
    expect(parts[0].length).toBe(24); // 12-byte IV = 24 hex
    expect(parts[1].length).toBe(32); // 16-byte Tag = 32 hex

    const decrypted = await decryptTokenVault(envelope, defaultContext);
    expect(decrypted).toEqual(samplePayload);
  });

  it('supports minimal payload with only required fields', async () => {
    const minimal: OAuthTokenPayload = {
      accessToken: 'minimal_token_123',
      expiresAt: 1770000000000,
    };
    const envelope = await encryptTokenVault(minimal, defaultContext);
    const decrypted = await decryptTokenVault(envelope, defaultContext);
    expect(decrypted).toEqual(minimal);
    expect(decrypted.refreshToken).toBeUndefined();
  });

  it('decrypts 2-part format (iv:cipherWithTag) correctly', async () => {
    const envelope = await encryptTokenVault(samplePayload, defaultContext);
    const parsed = parseVaultEnvelope(envelope);
    const twoPartEnvelope = `${parsed.ivHex}:${parsed.cipherHex}${parsed.tagHex}`;
    const decrypted = await decryptTokenVault(twoPartEnvelope, defaultContext);
    expect(decrypted).toEqual(samplePayload);
  });

  it('generates unique IVs and distinct ciphertexts for identical plaintext', async () => {
    const env1 = await encryptTokenVault(samplePayload, defaultContext);
    const env2 = await encryptTokenVault(samplePayload, defaultContext);
    expect(env1).not.toBe(env2);
    const iv1 = env1.split(':')[0];
    const iv2 = env2.split(':')[0];
    expect(iv1).not.toBe(iv2);
  });

  it('fails decryption when context channel or user does not match', async () => {
    const envelope = await encryptTokenVault(samplePayload, defaultContext);
    const differentContext: VaultDerivationContext = {
      ...defaultContext,
      channelId: 'UC_another_channel',
    };
    await expect(decryptTokenVault(envelope, differentContext)).rejects.toThrow(
      'Vault decryption failed'
    );
  });

  it('fails decryption when ciphertext or tag is tampered with', async () => {
    const envelope = await encryptTokenVault(samplePayload, defaultContext);
    const parts = envelope.split(':');
    const tamperedTag = parts[1].replace(/^(.)/, parts[1][0] === 'a' ? 'b' : 'a');
    const tamperedEnvelope = `${parts[0]}:${tamperedTag}:${parts[2]}`;
    await expect(decryptTokenVault(tamperedEnvelope, defaultContext)).rejects.toThrow(
      'Vault decryption failed'
    );
  });

  it('rejects invalid envelope structures and payload schemas', async () => {
    expect(() => parseVaultEnvelope('invalid_single_part')).toThrow('Invalid vault envelope');
    await expect(
      encryptTokenVault({ accessToken: '', expiresAt: 'not-num' as unknown as number }, defaultContext)
    ).rejects.toThrow('Invalid OAuthTokenPayload');

    delete process.env.SOCIAL_VAULT_MASTER_KEY;
    await expect(encryptString('secret', defaultContext)).rejects.toThrow('Master secret not found');
  });
});
