/**
 * Unit tests for Offline-Capable Web Crypto RaaS License Token Issuer & Verifier
 *
 * @module seed/security/__tests__/raas-license-verifier.test
 */

import { describe, expect, it } from 'vitest';
import {
  issueRaasLicenseToken,
  verifyRaasLicenseToken,
  type RaasLicensePayload,
} from '../raas-license-verifier';

const TEST_SECRET = 'sophia-raas-license-signing-secret-2026-test';

describe('RaaS License Token Issuer & Verifier', () => {
  const samplePayload: RaasLicensePayload = {
    licenseId: 'lic_master_001',
    orgId: 'org_agency_vn',
    edition: 'enterprise',
    tier: 'MASTER',
    issuedAt: 1760000000,
    expiresAt: 1800000000,
    whiteLabelEnabled: true,
  };

  it('issues and verifies a valid SOPHIA-RAAS-v1 token', async () => {
    const token = await issueRaasLicenseToken(samplePayload, TEST_SECRET);
    expect(token.startsWith('SOPHIA-RAAS-v1.')).toBe(true);

    const verification = await verifyRaasLicenseToken(token, TEST_SECRET, 1770000000);
    expect(verification.valid).toBe(true);
    expect(verification.payload).toEqual(samplePayload);
  });

  it('rejects a token when the signature or payload is tampered', async () => {
    const token = await issueRaasLicenseToken(samplePayload, TEST_SECRET);
    const tampered = `${token.slice(0, -4)}ffff`;

    const res = await verifyRaasLicenseToken(tampered, TEST_SECRET, 1770000000);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('SIGNATURE_MISMATCH');
  });

  it('rejects an expired license token', async () => {
    const token = await issueRaasLicenseToken(samplePayload, TEST_SECRET);
    const expiredCheck = await verifyRaasLicenseToken(token, TEST_SECRET, 1800000001);

    expect(expiredCheck.valid).toBe(false);
    expect(expiredCheck.reason).toBe('LICENSE_EXPIRED');
  });

  it('rejects malformed tokens or missing secrets safely', async () => {
    const missingSecret = await verifyRaasLicenseToken('SOPHIA-RAAS-v1.a.b', 'short');
    expect(missingSecret.valid).toBe(false);
    expect(missingSecret.reason).toBe('MISSING_SECRET');

    const malformed = await verifyRaasLicenseToken('invalid-token-format', TEST_SECRET);
    expect(malformed.valid).toBe(false);
    expect(malformed.reason).toBe('EMPTY_OR_MALFORMED_TOKEN');
  });
});
