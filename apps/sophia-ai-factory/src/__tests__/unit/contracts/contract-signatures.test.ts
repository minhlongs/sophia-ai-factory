/**
 * Unit Test Suite: Enterprise Contract Digital Signatures & Canonical Hashing
 *
 * Verifies RFC-8785 JSON Canonicalization, deterministic SHA-256 contract hashing,
 * dual-sided HMAC cryptographic signing (customer + platform counter-signature),
 * and tamper detection on all contract terms.
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalizeJson,
  computeContractHash,
  generateCustomerSignature,
  verifyCustomerSignature,
  generatePlatformSignature,
  verifyPlatformSignature,
  extractSignablePayload,
  verifyContractIntegrity,
} from '@/tree/contracts/contract-signature-verifier';
import type {
  EnterpriseContract,
  ContractSignablePayload,
} from '@/seed/types/enterprise-contracts';

describe('RFC-8785 JSON Canonicalization', () => {
  it('sorts object keys lexicographically', () => {
    const raw = { zebra: 1, apple: 2, mango: 3, banana: 4 };
    const canonical = canonicalizeJson(raw);
    expect(canonical).toBe('{"apple":2,"banana":4,"mango":3,"zebra":1}');
  });

  it('recursively sorts keys in nested objects while preserving array order', () => {
    const raw = {
      user: { title: 'CTO', name: 'Alice', age: 30 },
      tags: ['alpha', 'gamma', 'beta'],
      active: true,
      meta: { b: 2, a: 1 },
    };
    const canonical = canonicalizeJson(raw);
    expect(canonical).toBe(
      '{"active":true,"meta":{"a":1,"b":2},"tags":["alpha","gamma","beta"],"user":{"age":30,"name":"Alice","title":"CTO"}}',
    );
  });

  it('omits undefined properties and functions', () => {
    const raw = {
      name: 'Sophia',
      dummy: undefined,
      action: () => {},
      count: 42,
    };
    const canonical = canonicalizeJson(raw);
    expect(canonical).toBe('{"count":42,"name":"Sophia"}');
  });

  it('handles null, booleans, and numbers correctly', () => {
    expect(canonicalizeJson(null)).toBe('null');
    expect(canonicalizeJson(true)).toBe('true');
    expect(canonicalizeJson(false)).toBe('false');
    expect(canonicalizeJson(12345)).toBe('12345');
    expect(canonicalizeJson('hello world')).toBe('"hello world"');
  });
});

describe('Contract Canonical Hashing (SHA-256)', () => {
  const samplePayload1: ContractSignablePayload = {
    contractNumber: 'CNT-20260925-0001',
    orgId: 'org_enterprise_corp',
    mcuCapacityMonthly: 100_000,
    slaUptimePercent: 99.9,
    billingCycle: 'annual',
    unitPricePerMcuCents: 3.5,
    monthlyCommitmentCents: 350_000,
    annualCommitmentCents: 3_486_000,
    currency: 'USD',
    effectiveDate: '2026-10-01',
    expirationDate: '2027-10-01',
    termsVersion: '2026.1-ENTERPRISE-SLA',
  };

  it('produces identical 64-character lowercase hex digest regardless of key insertion order', async () => {
    const reorderedPayload: ContractSignablePayload = {
      termsVersion: '2026.1-ENTERPRISE-SLA',
      mcuCapacityMonthly: 100_000,
      currency: 'USD',
      orgId: 'org_enterprise_corp',
      slaUptimePercent: 99.9,
      contractNumber: 'CNT-20260925-0001',
      annualCommitmentCents: 3_486_000,
      billingCycle: 'annual',
      unitPricePerMcuCents: 3.5,
      expirationDate: '2027-10-01',
      effectiveDate: '2026-10-01',
      monthlyCommitmentCents: 350_000,
    };

    const hash1 = await computeContractHash(samplePayload1);
    const hash2 = await computeContractHash(reorderedPayload);

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it('produces different hash if any single property is modified', async () => {
    const baseHash = await computeContractHash(samplePayload1);

    // Modify MCU
    const modifiedMcu = { ...samplePayload1, mcuCapacityMonthly: 100_001 };
    expect(await computeContractHash(modifiedMcu)).not.toBe(baseHash);

    // Modify price
    const modifiedPrice = { ...samplePayload1, unitPricePerMcuCents: 3.49 };
    expect(await computeContractHash(modifiedPrice)).not.toBe(baseHash);

    // Modify contract number
    const modifiedNumber = { ...samplePayload1, contractNumber: 'CNT-20260925-0002' };
    expect(await computeContractHash(modifiedNumber)).not.toBe(baseHash);

    // Modify terms version
    const modifiedVersion = { ...samplePayload1, termsVersion: '2026.2-ENTERPRISE-SLA' };
    expect(await computeContractHash(modifiedVersion)).not.toBe(baseHash);
  });
});

describe('Customer & Platform Dual Cryptographic Signatures', () => {
  const contractHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const customerSecret = 'customer-secure-signing-secret-key-12345';
  const platformSecret = 'platform-master-authority-secret-key-67890';
  const signer = {
    email: 'cto@enterprise.com',
    timestamp: 1727280000,
  };

  it('generates and verifies customer HMAC-SHA256 signature', async () => {
    const signature = await generateCustomerSignature(contractHash, signer, customerSecret);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);

    // Verify valid signature
    const isValid = await verifyCustomerSignature(contractHash, signer, signature, customerSecret);
    expect(isValid).toBe(true);

    // Verification fails on wrong secret
    const wrongSecret = await verifyCustomerSignature(contractHash, signer, signature, 'wrong-secret');
    expect(wrongSecret).toBe(false);

    // Verification fails on tampered timestamp
    const tamperedTime = await verifyCustomerSignature(
      contractHash,
      { ...signer, timestamp: signer.timestamp + 1 },
      signature,
      customerSecret,
    );
    expect(tamperedTime).toBe(false);

    // Verification fails on altered email
    const tamperedEmail = await verifyCustomerSignature(
      contractHash,
      { ...signer, email: 'imposter@enterprise.com' },
      signature,
      customerSecret,
    );
    expect(tamperedEmail).toBe(false);

    // Verification fails on modified contract hash
    const tamperedHash = await verifyCustomerSignature(
      '0000000000000000000000000000000000000000000000000000000000000000',
      signer,
      signature,
      customerSecret,
    );
    expect(tamperedHash).toBe(false);
  });

  it('generates and verifies platform counter-signature binding contract and customer signature', async () => {
    const customerSig = await generateCustomerSignature(contractHash, signer, customerSecret);
    const platformSig = await generatePlatformSignature(contractHash, customerSig, platformSecret);

    expect(platformSig).toMatch(/^[a-f0-9]{64}$/);

    // Verify valid counter-signature
    const isValid = await verifyPlatformSignature(contractHash, customerSig, platformSig, platformSecret);
    expect(isValid).toBe(true);

    // Verification fails if customer signature was modified
    const tamperedCustomerSig = await verifyPlatformSignature(
      contractHash,
      'ff' + customerSig.slice(2),
      platformSig,
      platformSecret,
    );
    expect(tamperedCustomerSig).toBe(false);

    // Verification fails on incorrect platform secret
    const wrongKey = await verifyPlatformSignature(contractHash, customerSig, platformSig, 'fake-key');
    expect(wrongKey).toBe(false);
  });
});

describe('verifyContractIntegrity end-to-end audit', () => {
  const customerSecret = 'secret-session-auth-token-123';
  const platformSecret = 'secret-platform-authority-key-456';

  async function createSignedContractFixture(): Promise<EnterpriseContract> {
    const payload: ContractSignablePayload = {
      contractNumber: 'CNT-20260925-TEST',
      orgId: 'org_acme_global',
      mcuCapacityMonthly: 250_000,
      slaUptimePercent: 99.9,
      billingCycle: 'annual',
      unitPricePerMcuCents: 2.75,
      monthlyCommitmentCents: 687_500,
      annualCommitmentCents: 6_847_500,
      currency: 'USD',
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      termsVersion: '2026.1-ENTERPRISE-SLA',
    };

    const contractSha256 = await computeContractHash(payload);
    const signedAt = 1727280000;
    const signerEmail = 'signer@acme.com';

    const customerSig = await generateCustomerSignature(
      contractSha256,
      { email: signerEmail, timestamp: signedAt },
      customerSecret,
    );

    const platformSig = await generatePlatformSignature(
      contractSha256,
      customerSig,
      platformSecret,
    );

    return {
      id: 'ec_fixture_1',
      orgId: payload.orgId,
      contractNumber: payload.contractNumber,
      status: 'signed',
      slaUptimePercent: payload.slaUptimePercent,
      mcuCapacityMonthly: payload.mcuCapacityMonthly,
      billingCycle: payload.billingCycle,
      unitPricePerMcuCents: payload.unitPricePerMcuCents,
      volumeDiscountPercent: 0.45,
      monthlyCommitmentCents: payload.monthlyCommitmentCents,
      annualCommitmentCents: payload.annualCommitmentCents,
      currency: payload.currency,
      contractSha256,
      termsVersion: payload.termsVersion,
      effectiveDate: payload.effectiveDate,
      expirationDate: payload.expirationDate,
      customerSignerName: 'Jane Doe',
      customerSignerEmail: signerEmail,
      customerSignerTitle: 'Chief Information Officer',
      customerSignerIp: '192.168.1.1',
      customerSignatureHash: customerSig,
      customerSignedAt: signedAt,
      platformSignatureHash: platformSig,
      platformSignedAt: signedAt,
      createdAt: signedAt,
      updatedAt: signedAt,
    };
  }

  it('validates a pristine, untampered dual-signed contract', async () => {
    const contract = await createSignedContractFixture();
    const result = await verifyContractIntegrity(contract, customerSecret, platformSecret);

    expect(result.isValid).toBe(true);
    expect(result.customerSignatureValid).toBe(true);
    expect(result.platformSignatureValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('detects tampering when contract terms are modified post-signing', async () => {
    const contract = await createSignedContractFixture();

    // Attacker tampers capacity to 500,000 without updating terms hash
    const tampered = { ...contract, mcuCapacityMonthly: 500_000 };
    const result = await verifyContractIntegrity(tampered, customerSecret, platformSecret);

    expect(result.isValid).toBe(false);
    expect(result.customerSignatureValid).toBe(false);
    expect(result.platformSignatureValid).toBe(false);
    expect(result.reason).toContain('Contract terms hash mismatch');
  });

  it('detects tampering when price or billing cycle is forged', async () => {
    const contract = await createSignedContractFixture();

    // Attacker modifies unit price from 2.75 to 1.00
    const tamperedPrice = { ...contract, unitPricePerMcuCents: 1.00 };
    const res = await verifyContractIntegrity(tamperedPrice, customerSecret, platformSecret);

    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('Contract terms hash mismatch');
  });

  it('detects invalid customer signature when signature hash is tampered', async () => {
    const contract = await createSignedContractFixture();

    // Tamper customer signature hash
    const tamperedSig = { ...contract, customerSignatureHash: '00' + contract.customerSignatureHash?.slice(2) };
    const res = await verifyContractIntegrity(tamperedSig, customerSecret, platformSecret);

    expect(res.isValid).toBe(false);
    expect(res.customerSignatureValid).toBe(false);
    expect(res.reason).toContain('Customer cryptographic signature verification failed');
  });

  it('detects invalid platform counter-signature when counter-signature is forged', async () => {
    const contract = await createSignedContractFixture();

    // Tamper platform counter-signature hash
    const forgedPlatform = { ...contract, platformSignatureHash: 'deadbeef' + contract.platformSignatureHash?.slice(8) };
    const res = await verifyContractIntegrity(forgedPlatform, customerSecret, platformSecret);

    expect(res.isValid).toBe(false);
    expect(res.platformSignatureValid).toBe(false);
    expect(res.reason).toContain('Platform counter-signature verification failed');
  });
});
