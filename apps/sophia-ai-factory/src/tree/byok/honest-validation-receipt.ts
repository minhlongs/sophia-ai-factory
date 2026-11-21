/**
 * Honest, tamper-evident BYOK validation receipt contract for Track B1.
 *
 * Extends ValidationReceipt with explicit honesty guarantees:
 * - Syntax check vs encrypted storage vs live provider auth are distinct fields.
 * - Syntax-only validation ALWAYS reports providerAuthStatus: 'untested'.
 * - Validation NEVER executes paid inference (paidInferenceExecuted: false).
 * - HMAC-SHA256 signature binds the receipt to userId, orgId, and all claims
 *   so any client-side tampering is rejected fail-closed.
 *
 * @module tree/byok/honest-validation-receipt
 */

import { buildValidationReceipt } from '@/tree/byok/key-capability-gate';
import type {
  KeyBudgetState,
  KeyCapability,
  KeyPolicyStatus,
  ValidationReceipt,
} from '@/tree/byok/validation-receipt-types';

export type ProviderAuthStatus = 'verified' | 'untested' | 'rejected' | 'unreachable';
export type CapabilitiesKnowledge = 'probed' | 'inferred_from_provider_table' | 'unknown';
export type ReceiptCostBasis = 'estimated' | 'actual' | 'unavailable';

export interface HonestValidationReceiptBody extends ValidationReceipt {
  readonly receiptId: string;
  readonly userId: string;
  readonly orgId: string;
  readonly keyFormatAccepted: boolean;
  readonly keyStoredSecurely: boolean;
  readonly providerAuthStatus: ProviderAuthStatus;
  readonly capabilitiesKnown: CapabilitiesKnowledge;
  readonly costBasis: ReceiptCostBasis;
  readonly paidInferenceExecuted: false;
}

export interface HonestValidationReceipt extends HonestValidationReceiptBody {
  readonly receiptIntegrity: {
    readonly algorithm: 'hmac-sha256';
    readonly signature: string;
  };
}

export interface BuildHonestReceiptInput {
  readonly receiptId?: string;
  readonly userId: string;
  readonly orgId: string;
  readonly provider: string;
  readonly maskedKey: string;
  readonly keyFormatAccepted: boolean;
  readonly keyStoredSecurely: boolean;
  readonly providerAuthStatus: ProviderAuthStatus;
  readonly probedCapabilities?: readonly KeyCapability[];
  readonly budget?: KeyBudgetState;
  readonly policyStatus?: KeyPolicyStatus;
  readonly costBasis?: ReceiptCostBasis;
  readonly nowUnix?: number;
  readonly signingSecret: string;
}

function canonicalizeReceiptBody(body: HonestValidationReceiptBody): string {
  return JSON.stringify({
    receiptId: body.receiptId,
    userId: body.userId,
    orgId: body.orgId,
    provider: body.provider,
    maskedKey: body.maskedKey,
    checkedAtUnix: body.checkedAtUnix,
    capabilities: [...body.capabilities],
    budget: {
      monthlyBudgetUsd: body.budget.monthlyBudgetUsd,
      monthSpentUsd: body.budget.monthSpentUsd,
      cooldownUntil: body.budget.cooldownUntil,
    },
    verdict: body.verdict,
    policyStatus: body.policyStatus ?? null,
    keyFormatAccepted: body.keyFormatAccepted,
    keyStoredSecurely: body.keyStoredSecurely,
    providerAuthStatus: body.providerAuthStatus,
    capabilitiesKnown: body.capabilitiesKnown,
    costBasis: body.costBasis,
    paidInferenceExecuted: body.paidInferenceExecuted,
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function computeHmacHex(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Constructs and HMAC-signs an HonestValidationReceipt.
 * Guarantees that an unformatted key cannot be marked verified, and that
 * validation never records paid inference.
 */
export async function createHonestValidationReceipt(
  input: BuildHonestReceiptInput,
): Promise<HonestValidationReceipt> {
  if (!input.signingSecret || input.signingSecret.trim().length < 16) {
    throw new Error('Receipt signing secret must be at least 16 characters');
  }

  const nowUnix = input.nowUnix ?? Math.floor(Date.now() / 1000);
  const budget: KeyBudgetState = input.budget ?? {
    monthlyBudgetUsd: null,
    monthSpentUsd: 0,
    cooldownUntil: null,
  };

  const base = buildValidationReceipt({
    provider: input.provider,
    maskedKey: input.maskedKey,
    probedCapabilities: input.probedCapabilities,
    budget,
    policyStatus: input.policyStatus,
    nowUnix,
  });

  // Invariant: if format was rejected, providerAuthStatus can never be 'verified'.
  const safeAuthStatus: ProviderAuthStatus =
    !input.keyFormatAccepted && input.providerAuthStatus === 'verified'
      ? 'rejected'
      : input.providerAuthStatus;

  const capabilitiesKnown: CapabilitiesKnowledge = input.probedCapabilities
    ? 'probed'
    : base.capabilities.length > 0
      ? 'inferred_from_provider_table'
      : 'unknown';

  const body: HonestValidationReceiptBody = {
    ...base,
    receiptId: input.receiptId ?? crypto.randomUUID(),
    userId: input.userId,
    orgId: input.orgId,
    keyFormatAccepted: input.keyFormatAccepted,
    keyStoredSecurely: input.keyStoredSecurely,
    providerAuthStatus: safeAuthStatus,
    capabilitiesKnown,
    costBasis: input.costBasis ?? 'estimated',
    paidInferenceExecuted: false,
  };

  const signature = await computeHmacHex(canonicalizeReceiptBody(body), input.signingSecret);
  return {
    ...body,
    receiptIntegrity: {
      algorithm: 'hmac-sha256',
      signature,
    },
  };
}

export interface ReceiptVerificationResult {
  readonly valid: boolean;
  readonly reason?:
    | 'INVALID_SHAPE'
    | 'INVALID_SIGNATURE'
    | 'TENANT_MISMATCH'
    | 'PAID_INFERENCE_FLAG_TAMPERED'
    | 'RECEIPT_EXPIRED';
}

function hasValidReceiptShape(receipt: HonestValidationReceipt): boolean {
  return Boolean(
    receipt &&
      typeof receipt === 'object' &&
      typeof receipt.receiptId === 'string' &&
      typeof receipt.userId === 'string' &&
      typeof receipt.orgId === 'string' &&
      typeof receipt.provider === 'string' &&
      typeof receipt.maskedKey === 'string' &&
      typeof receipt.checkedAtUnix === 'number' &&
      Number.isFinite(receipt.checkedAtUnix) &&
      Array.isArray(receipt.capabilities) &&
      receipt.budget &&
      typeof receipt.budget === 'object' &&
      receipt.receiptIntegrity &&
      receipt.receiptIntegrity.algorithm === 'hmac-sha256' &&
      typeof receipt.receiptIntegrity.signature === 'string',
  );
}

/**
 * Verifies receipt integrity, optional TTL, and tenant binding fail-closed.
 */
export async function verifyHonestValidationReceipt(
  receipt: HonestValidationReceipt,
  expected: {
    readonly userId: string;
    readonly orgId: string;
    readonly signingSecret: string;
    readonly maxAgeSec?: number;
    readonly nowUnix?: number;
  },
): Promise<ReceiptVerificationResult> {
  if (!expected.signingSecret || expected.signingSecret.trim().length < 16) {
    return { valid: false, reason: 'INVALID_SHAPE' };
  }

  if (!hasValidReceiptShape(receipt)) {
    return { valid: false, reason: 'INVALID_SHAPE' };
  }

  if (receipt.paidInferenceExecuted !== false) {
    return { valid: false, reason: 'PAID_INFERENCE_FLAG_TAMPERED' };
  }

  if (receipt.userId !== expected.userId || receipt.orgId !== expected.orgId) {
    return { valid: false, reason: 'TENANT_MISMATCH' };
  }

  if (expected.maxAgeSec !== undefined && expected.maxAgeSec >= 0) {
    const nowUnix = expected.nowUnix ?? Math.floor(Date.now() / 1000);
    if (nowUnix - receipt.checkedAtUnix > expected.maxAgeSec) {
      return { valid: false, reason: 'RECEIPT_EXPIRED' };
    }
  }

  const { receiptIntegrity, ...body } = receipt;
  const expectedSig = await computeHmacHex(
    canonicalizeReceiptBody(body),
    expected.signingSecret,
  );

  if (!timingSafeEqualHex(receiptIntegrity.signature, expectedSig)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  return { valid: true };
}
