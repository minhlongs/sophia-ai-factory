/**
 * Enterprise Contract Signature Verifier & Canonical Hasher
 *
 * Implements RFC-8785 JSON Canonicalization Scheme (JCS), deterministic SHA-256 contract hashing,
 * and dual-sided HMAC-SHA256 cryptographic verification for customer and platform counter-signatures.
 * Runs 100% on Cloudflare Workers edge runtime via Web Crypto API.
 *
 * Layer: tree (Pure domain logic & cryptographic verification)
 *
 * @module tree/contracts/contract-signature-verifier
 */

import type {
  EnterpriseContract,
  ContractSignablePayload,
  ContractSignatureVerificationResult,
} from '@/seed/types/enterprise-contracts';
import { sha256Hex } from '@/seed/security/token-hash';
import { computeHmacHex, timingSafeEqual } from '@/seed/security/signature';

/**
 * Deterministic RFC-8785 JSON Canonicalization Scheme (JCS).
 * - Sorts object keys lexicographically by UTF-16 code units
 * - Omit undefined values and functions
 * - Serializes primitives without non-significant whitespace
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
      return '';
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const elements = value.map((el) => {
      const canonical = canonicalizeJson(el);
      return canonical === '' ? 'null' : canonical;
    });
    return `[${elements.join(',')}]`;
  }

  // Value is an object (non-null, non-array)
  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const entries: string[] = [];

  for (const key of sortedKeys) {
    const val = record[key];
    if (val === undefined || typeof val === 'function' || typeof val === 'symbol') {
      continue;
    }
    const serializedVal = canonicalizeJson(val);
    entries.push(`${JSON.stringify(key)}:${serializedVal}`);
  }

  return `{${entries.join(',')}}`;
}

/**
 * Compute the 64-character lowercase hexadecimal SHA-256 hash of a signable contract payload.
 *
 * @param payload Canonical signable terms and commitments
 * @returns 64-char lowercase hex digest
 */
export async function computeContractHash(payload: ContractSignablePayload): Promise<string> {
  const canonicalString = canonicalizeJson(payload);
  return sha256Hex(canonicalString);
}

/**
 * Generate a digital signature hash for the customer authorized signatory.
 *
 * @param contractSha256 The 64-char hex SHA-256 digest of canonical terms
 * @param signer Signer email and signing timestamp
 * @param secret Private signing secret / salt (e.g. session token or org signing secret)
 */
export async function generateCustomerSignature(
  contractSha256: string,
  signer: { email: string; timestamp: number },
  secret: string,
): Promise<string> {
  const message = `CUSTOMER_SIGNATURE:${contractSha256}:${signer.email.toLowerCase().trim()}:${signer.timestamp}`;
  return computeHmacHex(message, secret, 'SHA-256');
}

/**
 * Verify customer signature against contract hash and signing details.
 */
export async function verifyCustomerSignature(
  contractSha256: string,
  signer: { email: string; timestamp: number },
  signatureHash: string,
  secret: string,
): Promise<boolean> {
  try {
    const expected = await generateCustomerSignature(contractSha256, signer, secret);
    return timingSafeEqual(expected.toLowerCase(), signatureHash.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Platform counter-signature authority key.
 * Falls back to deterministic seed for edge test environments if env not set.
 */
function getPlatformSigningKey(overrideKey?: string): string {
  if (overrideKey) return overrideKey;
  return (
    process.env.CONTRACT_SIGNING_SECRET ||
    process.env.SESSION_SECRET ||
    'sophia-enterprise-platform-counter-signature-key-2026'
  );
}

/**
 * Generate an automated platform counter-signature by Sophia AI Factory signing authority.
 * Binds the contract terms hash and customer signature hash together.
 */
export async function generatePlatformSignature(
  contractSha256: string,
  customerSignatureHash: string,
  platformSecret?: string,
): Promise<string> {
  const secret = getPlatformSigningKey(platformSecret);
  const message = `PLATFORM_COUNTERSIGN:${contractSha256}:${customerSignatureHash}`;
  return computeHmacHex(message, secret, 'SHA-256');
}

/**
 * Verify platform counter-signature hash.
 */
export async function verifyPlatformSignature(
  contractSha256: string,
  customerSignatureHash: string,
  platformSignatureHash: string,
  platformSecret?: string,
): Promise<boolean> {
  try {
    const expected = await generatePlatformSignature(
      contractSha256,
      customerSignatureHash,
      platformSecret,
    );
    return timingSafeEqual(expected.toLowerCase(), platformSignatureHash.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Reconstruct canonical signable payload from an EnterpriseContract entity.
 */
export function extractSignablePayload(contract: EnterpriseContract): ContractSignablePayload {
  return {
    contractNumber: contract.contractNumber,
    orgId: contract.orgId,
    mcuCapacityMonthly: contract.mcuCapacityMonthly,
    slaUptimePercent: contract.slaUptimePercent,
    billingCycle: contract.billingCycle,
    unitPricePerMcuCents: contract.unitPricePerMcuCents,
    monthlyCommitmentCents: contract.monthlyCommitmentCents,
    annualCommitmentCents: contract.annualCommitmentCents,
    currency: contract.currency,
    effectiveDate: contract.effectiveDate,
    expirationDate: contract.expirationDate,
    termsVersion: contract.termsVersion,
  };
}

/**
 * Comprehensive dual-sided verification of contract integrity and cryptographic signatures.
 * Detects any tampering in contract terms, values, dates, or signatures.
 */
export async function verifyContractIntegrity(
  contract: EnterpriseContract,
  customerSecret: string,
  platformSecret?: string,
): Promise<ContractSignatureVerificationResult> {
  // 1. Recompute SHA-256 hash of canonical terms
  const payload = extractSignablePayload(contract);
  const recomputedHash = await computeContractHash(payload);

  if (!timingSafeEqual(recomputedHash, contract.contractSha256)) {
    return {
      isValid: false,
      contractSha256: recomputedHash,
      customerSignatureValid: false,
      platformSignatureValid: false,
      reason: 'Contract terms hash mismatch: canonical payload has been modified or tampered with.',
    };
  }

  // 2. Verify customer signature if present
  let customerSignatureValid = false;
  if (
    contract.customerSignatureHash &&
    contract.customerSignerEmail &&
    contract.customerSignedAt
  ) {
    customerSignatureValid = await verifyCustomerSignature(
      recomputedHash,
      {
        email: contract.customerSignerEmail,
        timestamp: contract.customerSignedAt,
      },
      contract.customerSignatureHash,
      customerSecret,
    );

    if (!customerSignatureValid) {
      return {
        isValid: false,
        contractSha256: recomputedHash,
        customerSignatureValid: false,
        platformSignatureValid: false,
        reason: 'Customer cryptographic signature verification failed.',
      };
    }
  }

  // 3. Verify platform counter-signature if present
  let platformSignatureValid = false;
  if (contract.platformSignatureHash && contract.customerSignatureHash) {
    platformSignatureValid = await verifyPlatformSignature(
      recomputedHash,
      contract.customerSignatureHash,
      contract.platformSignatureHash,
      platformSecret,
    );

    if (!platformSignatureValid) {
      return {
        isValid: false,
        contractSha256: recomputedHash,
        customerSignatureValid,
        platformSignatureValid: false,
        reason: 'Platform counter-signature verification failed.',
      };
    }
  }

  const fullySigned = Boolean(customerSignatureValid && platformSignatureValid);

  return {
    isValid: fullySigned,
    contractSha256: recomputedHash,
    customerSignatureValid,
    platformSignatureValid,
    reason: fullySigned ? undefined : 'Contract is partially signed or pending signature.',
  };
}
