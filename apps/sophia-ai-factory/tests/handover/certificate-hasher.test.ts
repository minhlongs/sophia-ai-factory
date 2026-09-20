/**
 * Certificate Hasher & Tamper-Evidence Test Suite
 * Tests: SHA-256 generation, canonical serialization, verification, and tamper detection.
 *
 * @vitest
 */

import { describe, it, expect } from 'vitest';
import {
  hashStringSha256,
  canonicalizeCertificatePayload,
  generateCertificateSha256,
  verifyCertificateSha256,
} from '@/seed/handover/certificate-hasher';
import type { HandoverCertificatePayload } from '@/seed/handover/handover-types';

describe('Certificate Hasher & Tamper-evidence Engine', () => {
  const samplePayload: HandoverCertificatePayload = {
    handoverId: 'ho_test_12345678',
    tenantId: 'tenant_omega_01',
    customerName: 'Acme Digital Agency',
    customerEmail: 'founder@acmedigital.io',
    signerName: 'Jane Doe',
    signerEmail: 'jane.doe@acmedigital.io',
    signerRole: 'Managing Director & CEO',
    tier: 'SCALE',
    deployedSha: 'a1b2c3d4e5f6',
    timestamp: 1774000000000,
    acceptanceCheckpoints: [
      'Access to all 10 Customer Runbooks received, reviewed, and archived.',
      'Test video generated and verified through creative mission pipeline.',
      'Sensitive API keys and BYOK credentials verified under exclusive customer control.',
      'Support escalation channels, diagnostic export procedures, and disaster recovery validated.',
    ],
    manifestHash: 'sha256_manifest_987654321',
  };

  describe('hashStringSha256', () => {
    it('computes exact SHA-256 64-char hexadecimal string', async () => {
      const hash = await hashStringSha256('hello world');
      expect(hash).toHaveLength(64);
      // Known standard SHA-256 of "hello world"
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('handles empty string properly', async () => {
      const hash = await hashStringSha256('');
      // Known SHA-256 for empty string
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('handles unicode and multilingual strings correctly', async () => {
      const hashEn = await hashStringSha256('Handover Acceptance');
      const hashVi = await hashStringSha256('Nghiệm Thu Bàn Giao Khách Hàng');
      expect(hashVi).toHaveLength(64);
      expect(hashEn).not.toBe(hashVi);
    });
  });

  describe('canonicalizeCertificatePayload', () => {
    it('produces deterministic output regardless of checkpoint ordering', () => {
      const payload1: HandoverCertificatePayload = {
        ...samplePayload,
        acceptanceCheckpoints: ['Zebra checkpoint', 'Alpha checkpoint', 'Beta checkpoint'],
      };

      const payload2: HandoverCertificatePayload = {
        ...samplePayload,
        acceptanceCheckpoints: ['Alpha checkpoint', 'Beta checkpoint', 'Zebra checkpoint'],
      };

      const json1 = canonicalizeCertificatePayload(payload1);
      const json2 = canonicalizeCertificatePayload(payload2);
      expect(json1).toBe(json2);
    });

    it('normalizes email casing and trims leading/trailing whitespace', () => {
      const dirtyPayload: HandoverCertificatePayload = {
        ...samplePayload,
        customerEmail: '  FOunder@AcmeDigital.IO  ',
        signerEmail: '  Jane.Doe@AcmeDigital.IO ',
        customerName: '  Acme Digital Agency  ',
        deployedSha: '  A1B2C3D4E5F6  ',
        tier: 'scale  ',
      };

      const cleanJson = canonicalizeCertificatePayload(dirtyPayload);
      const parsed = JSON.parse(cleanJson);

      expect(parsed.customerEmail).toBe('founder@acmedigital.io');
      expect(parsed.signerEmail).toBe('jane.doe@acmedigital.io');
      expect(parsed.customerName).toBe('Acme Digital Agency');
      expect(parsed.deployedSha).toBe('a1b2c3d4e5f6');
      expect(parsed.tier).toBe('SCALE');
    });

    it('handles null and undefined optional fields predictably', () => {
      const noTenantPayload: HandoverCertificatePayload = {
        ...samplePayload,
        tenantId: null,
        manifestHash: undefined,
      };

      const json = canonicalizeCertificatePayload(noTenantPayload);
      const parsed = JSON.parse(json);
      expect(parsed.tenantId).toBeNull();
      expect(parsed.manifestHash).toBe('');
    });
  });

  describe('generateCertificateSha256 & verifyCertificateSha256', () => {
    it('generates consistent 64-char hash digest and verifies successfully', async () => {
      const hash1 = await generateCertificateSha256(samplePayload);
      const hash2 = await generateCertificateSha256(samplePayload);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);

      const isValid = await verifyCertificateSha256(samplePayload, hash1);
      expect(isValid).toBe(true);
    });

    it('verifies correctly with uppercase or padded expected hash', async () => {
      const hash = await generateCertificateSha256(samplePayload);
      const isValid = await verifyCertificateSha256(samplePayload, `  ${hash.toUpperCase()}  `);
      expect(isValid).toBe(true);
    });

    it('returns false for invalid or corrupt hashes', async () => {
      expect(await verifyCertificateSha256(samplePayload, '')).toBe(false);
      expect(await verifyCertificateSha256(samplePayload, 'invalid_length_hash')).toBe(false);
      expect(await verifyCertificateSha256(samplePayload, '0'.repeat(64))).toBe(false);
    });
  });

  describe('Adversarial Tamper-evidence Verification', () => {
    it('detects tampering in signer name', async () => {
      const originalHash = await generateCertificateSha256(samplePayload);

      const tampered: HandoverCertificatePayload = {
        ...samplePayload,
        signerName: 'Jane Smith', // Altered
      };

      const isValid = await verifyCertificateSha256(tampered, originalHash);
      expect(isValid).toBe(false);
    });

    it('detects tampering in signer email domain', async () => {
      const originalHash = await generateCertificateSha256(samplePayload);

      const tampered: HandoverCertificatePayload = {
        ...samplePayload,
        signerEmail: 'jane.doe@attacker.com',
      };

      const isValid = await verifyCertificateSha256(tampered, originalHash);
      expect(isValid).toBe(false);
    });

    it('detects tampering in signer role', async () => {
      const originalHash = await generateCertificateSha256(samplePayload);

      const tampered: HandoverCertificatePayload = {
        ...samplePayload,
        signerRole: 'Unverified Contractor',
      };

      const isValid = await verifyCertificateSha256(tampered, originalHash);
      expect(isValid).toBe(false);
    });

    it('detects tampering in deployed commit SHA', async () => {
      const originalHash = await generateCertificateSha256(samplePayload);

      const tampered: HandoverCertificatePayload = {
        ...samplePayload,
        deployedSha: 'f9e8d7c6b5a4',
      };

      const isValid = await verifyCertificateSha256(tampered, originalHash);
      expect(isValid).toBe(false);
    });

    it('detects timestamp manipulation by even 1 millisecond', async () => {
      const originalHash = await generateCertificateSha256(samplePayload);

      const tampered: HandoverCertificatePayload = {
        ...samplePayload,
        timestamp: samplePayload.timestamp + 1,
      };

      const isValid = await verifyCertificateSha256(tampered, originalHash);
      expect(isValid).toBe(false);
    });

    it('detects removal or modification of acceptance statements', async () => {
      const originalHash = await generateCertificateSha256(samplePayload);

      const tampered: HandoverCertificatePayload = {
        ...samplePayload,
        acceptanceCheckpoints: samplePayload.acceptanceCheckpoints.slice(0, 3), // Missing 4th checkpoint
      };

      const isValid = await verifyCertificateSha256(tampered, originalHash);
      expect(isValid).toBe(false);
    });

    it('detects subtle tampering in tier string', async () => {
      const originalHash = await generateCertificateSha256(samplePayload);

      const tampered: HandoverCertificatePayload = {
        ...samplePayload,
        tier: 'ENTERPRISE', // Altered from SCALE
      };

      const isValid = await verifyCertificateSha256(tampered, originalHash);
      expect(isValid).toBe(false);
    });
  });
});
