/**
 * Unit & Adversarial Tests: CMEK Envelope Encryption Engine
 *
 * Verifies:
 * 1. Web Crypto AES-256-GCM key generation, fingerprinting, and zeroization
 * 2. KEK wrapping & unwrapping of Data Encryption Keys (DEK)
 * 3. Envelope encryption round-trip with Authenticated Additional Data (AAD)
 * 4. Adversarial tamper detection:
 *    - Ciphertext byte flipping triggers AES-GCM auth tag rejection
 *    - Cross-tenant tampering (modifying orgId in AAD) throws CmekTamperError
 *    - Cross-jurisdiction smuggling (modifying zoneCode in AAD) throws CmekTamperError
 *    - Key version spoofing throws CmekTamperError
 * 5. Zero-knowledge crypto-shredding irreversibility
 * 6. Automated key rotation lifecycle
 */

import { describe, it, expect } from 'vitest';
import {
  generateRawKey,
  computeKeyFingerprint,
  zeroizeKey,
  wrapDek,
  unwrapDek,
  encryptWithEnvelope,
  decryptWithEnvelope,
  cryptoShredDek,
  initializeTenantSovereignKey,
  rotateTenantSovereignKey,
  CmekTamperError,
  CmekCryptoError,
  base64ToBytes,
  bytesToBase64,
} from '../cmek-envelope-engine';
import type { EnvelopeAad } from '@/seed/types/sovereign-vault';

describe('CMEK Envelope Encryption Engine', () => {
  describe('Key Generation & Fingerprinting', () => {
    it('generates cryptographically secure 256-bit (32 byte) keys', () => {
      const key1 = generateRawKey();
      const key2 = generateRawKey();
      expect(key1.byteLength).toBe(32);
      expect(key2.byteLength).toBe(32);
      expect(key1).not.toEqual(key2);
    });

    it('computes deterministic SHA-256 fingerprint of key bytes', async () => {
      const key = generateRawKey();
      const fp1 = await computeKeyFingerprint(key);
      const fp2 = await computeKeyFingerprint(key);
      expect(fp1).toHaveLength(64);
      expect(fp1).toBe(fp2);
    });

    it('zeroizes key memory buffer completely', () => {
      const key = generateRawKey();
      const clone = new Uint8Array(key);
      expect(key.some((b) => b !== 0)).toBe(true);

      zeroizeKey(key);
      expect(key.every((b) => b === 0)).toBe(true);
      expect(clone.some((b) => b !== 0)).toBe(true);
    });
  });

  describe('DEK Wrapping & Unwrapping (Envelope Key Transport)', () => {
    it('wraps and unwraps DEK using KEK bit-for-bit identically', async () => {
      const rawKek = generateRawKey();
      const rawDek = generateRawKey();

      const { wrappedDekBase64, dekIvBase64 } = await wrapDek(rawDek, rawKek);
      expect(wrappedDekBase64).toBeDefined();
      expect(dekIvBase64).toBeDefined();

      const recoveredDek = await unwrapDek(wrappedDekBase64, dekIvBase64, rawKek);
      expect(recoveredDek).toEqual(rawDek);
    });

    it('fails to unwrap DEK when an incorrect KEK is used', async () => {
      const correctKek = generateRawKey();
      const wrongKek = generateRawKey();
      const rawDek = generateRawKey();

      const { wrappedDekBase64, dekIvBase64 } = await wrapDek(rawDek, correctKek);

      await expect(unwrapDek(wrappedDekBase64, dekIvBase64, wrongKek)).rejects.toThrow(
        CmekCryptoError,
      );
    });

    it('fails to unwrap DEK when wrapped ciphertext is corrupted or tampered', async () => {
      const rawKek = generateRawKey();
      const rawDek = generateRawKey();

      const { wrappedDekBase64, dekIvBase64 } = await wrapDek(rawDek, rawKek);

      // Tamper single byte in wrapped ciphertext
      const bytes = base64ToBytes(wrappedDekBase64);
      bytes[0] ^= 0xff;
      const tamperedB64 = bytesToBase64(bytes);

      await expect(unwrapDek(tamperedB64, dekIvBase64, rawKek)).rejects.toThrow(
        CmekCryptoError,
      );
    });
  });

  describe('Envelope Data Encryption & Decryption Round-Trip', () => {
    it('encrypts and decrypts UTF-8 plaintext with AAD binding', async () => {
      const rawDek = generateRawKey();
      const aad: EnvelopeAad = {
        orgId: 'org_acme_corp',
        zoneCode: 'EU',
        keyVersion: 1,
        algorithm: 'AES-256-GCM',
      };

      const secretText = 'Confidential GDPR Data: User email is client@acme.eu with salary $150,000';
      const { envelopeString, payload } = await encryptWithEnvelope(
        secretText,
        rawDek,
        aad,
        'key_123',
        1,
      );

      expect(envelopeString.startsWith('cmek-v1:key_123:1:')).toBe(true);
      expect(payload.ciphertextBase64).toBeDefined();

      const decrypted = await decryptWithEnvelope(envelopeString, rawDek, aad);
      expect(decrypted).toBe(secretText);
    });

    it('encrypts raw byte array and decrypts faithfully', async () => {
      const rawDek = generateRawKey();
      const aad: EnvelopeAad = {
        orgId: 'org_vietnam_media',
        zoneCode: 'VN',
        keyVersion: 1,
        algorithm: 'AES-256-GCM',
      };

      const binaryData = new Uint8Array([0x00, 0x01, 0xde, 0xad, 0xbe, 0xef, 0xff]);
      const { envelopeString } = await encryptWithEnvelope(binaryData, rawDek, aad, 'key_vn_1', 1);

      const decrypted = await decryptWithEnvelope(envelopeString, rawDek, aad);
      const expected = new TextDecoder().decode(binaryData);
      expect(decrypted).toBe(expected);
    });
  });

  describe('Adversarial Tamper & Splicing Detection', () => {
    const rawDek = generateRawKey();
    const aad: EnvelopeAad = {
      orgId: 'org_alpha',
      zoneCode: 'EU',
      keyVersion: 1,
      algorithm: 'AES-256-GCM',
    };
    const plaintext = 'Secret Enterprise Financial Ledger';

    it('detects single-bit flip in ciphertext (AES-GCM Auth Tag Failure)', async () => {
      const { envelopeString } = await encryptWithEnvelope(plaintext, rawDek, aad, 'k1', 1);
      const parts = envelopeString.split(':');
      const ctBytes = base64ToBytes(parts[4]);
      ctBytes[5] ^= 0x01; // flip 1 bit
      parts[4] = bytesToBase64(ctBytes);
      const tamperedEnvelope = parts.join(':');

      await expect(decryptWithEnvelope(tamperedEnvelope, rawDek, aad)).rejects.toThrow(
        CmekTamperError,
      );
    });

    it('detects tampering with IV in envelope', async () => {
      const { envelopeString } = await encryptWithEnvelope(plaintext, rawDek, aad, 'k1', 1);
      const parts = envelopeString.split(':');
      const ivBytes = base64ToBytes(parts[3]);
      ivBytes[0] ^= 0xff;
      parts[3] = bytesToBase64(ivBytes);
      const tamperedEnvelope = parts.join(':');

      await expect(decryptWithEnvelope(tamperedEnvelope, rawDek, aad)).rejects.toThrow(
        CmekTamperError,
      );
    });

    it('detects cross-tenant ciphertext splicing (modified orgId in AAD)', async () => {
      const { envelopeString } = await encryptWithEnvelope(plaintext, rawDek, aad, 'k1', 1);

      // Attacker attempts to decrypt tenant Alpha data under tenant Beta
      const attackerAad: EnvelopeAad = {
        orgId: 'org_beta',
        zoneCode: 'EU',
        keyVersion: 1,
        algorithm: 'AES-256-GCM',
      };

      await expect(decryptWithEnvelope(envelopeString, rawDek, attackerAad)).rejects.toThrow(
        CmekTamperError,
      );
    });

    it('detects cross-jurisdiction smuggling (modified zoneCode in AAD)', async () => {
      const { envelopeString } = await encryptWithEnvelope(plaintext, rawDek, aad, 'k1', 1);

      // Attacker attempts to process EU data in US jurisdiction
      const smuggledAad: EnvelopeAad = {
        orgId: 'org_alpha',
        zoneCode: 'US',
        keyVersion: 1,
        algorithm: 'AES-256-GCM',
      };

      await expect(decryptWithEnvelope(envelopeString, rawDek, smuggledAad)).rejects.toThrow(
        CmekTamperError,
      );
    });

    it('rejects key version mismatch', async () => {
      const { envelopeString } = await encryptWithEnvelope(plaintext, rawDek, aad, 'k1', 1);

      const wrongVersionAad: EnvelopeAad = {
        orgId: 'org_alpha',
        zoneCode: 'EU',
        keyVersion: 2,
        algorithm: 'AES-256-GCM',
      };

      await expect(decryptWithEnvelope(envelopeString, rawDek, wrongVersionAad)).rejects.toThrow(
        CmekTamperError,
      );
    });
  });

  describe('Zero-Knowledge Crypto-Shredding Irreversibility', () => {
    it('permanently destroys wrapped DEK with random entropy', async () => {
      const rawKek = generateRawKey();
      const rawDek = generateRawKey();
      const { wrappedDekBase64, dekIvBase64 } = await wrapDek(rawDek, rawKek);

      // Verify unwrap works initially
      const recovered = await unwrapDek(wrappedDekBase64, dekIvBase64, rawKek);
      expect(recovered).toEqual(rawDek);

      // Execute crypto-shredding
      const { shreddedDekBase64 } = cryptoShredDek();
      expect(shreddedDekBase64).not.toBe(wrappedDekBase64);

      // Subsequent unwrap attempt must fail irreversibly
      await expect(unwrapDek(shreddedDekBase64, dekIvBase64, rawKek)).rejects.toThrow(
        CmekCryptoError,
      );
    });
  });

  describe('Key Lifecycle & Rotation', () => {
    it('initializes key record with wrapped DEK and fingerprint', async () => {
      const { keyRecord, rawDek, rawKek } = await initializeTenantSovereignKey({
        orgId: 'org_enterprise_1',
        zoneId: 'zone_eu_gdpr',
        zoneCode: 'EU',
        keyAlias: 'master_doc_key',
      });

      expect(keyRecord.keyVersion).toBe(1);
      expect(keyRecord.keyState).toBe('active');
      expect(keyRecord.wrappedDekCiphertext).toBeDefined();

      const unwrapped = await unwrapDek(
        keyRecord.wrappedDekCiphertext,
        keyRecord.dekIvBase64,
        rawKek,
      );
      expect(unwrapped).toEqual(rawDek);
    });

    it('rotates sovereign key incrementing version and issuing new DEK', async () => {
      const { keyRecord: v1Record, rawKek } = await initializeTenantSovereignKey({
        orgId: 'org_rot_test',
        zoneId: 'zone_vn_pdpd',
        zoneCode: 'VN',
        keyAlias: 'vault_key',
      });

      const { rotatedKeyRecord: v2Record, newRawDek } = await rotateTenantSovereignKey(
        v1Record,
        rawKek,
      );

      expect(v2Record.keyVersion).toBe(2);
      expect(v2Record.id).toContain('_v2');
      expect(v2Record.wrappedDekCiphertext).not.toBe(v1Record.wrappedDekCiphertext);

      const unwrappedV2 = await unwrapDek(
        v2Record.wrappedDekCiphertext,
        v2Record.dekIvBase64,
        rawKek,
      );
      expect(unwrappedV2).toEqual(newRawDek);
    });
  });
});
