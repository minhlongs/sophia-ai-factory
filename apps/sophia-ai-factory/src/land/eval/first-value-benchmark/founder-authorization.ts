/**
 * Cryptographic Founder authorization boundary for Stage 1 live calibration.
 * Enforces detached Ed25519 signatures over domain-separated canonical payloads,
 * an operator-controlled trust anchor, and single-use nonce replay protection.
 *
 * @module land/eval/first-value-benchmark/founder-authorization
 */

import { createHash, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const FOUNDER_AUTH_SCHEMA_VERSION = 'sophia-b4-founder-auth-v1' as const;
export const FOUNDER_AUTH_DOMAIN = 'sophia-b4-stage1-authorization-v1' as const;
export const FOUNDER_RECONCILIATION_DOMAIN = 'sophia-b4-stage1-usage-reconciliation-v1' as const;
export const FOUNDER_TRUST_ANCHOR_NOT_PROVISIONED = 'FOUNDER_TRUST_ANCHOR_NOT_PROVISIONED' as const;
export const PROVIDER_CAP_UNVERIFIED = 'PROVIDER_CAP_UNVERIFIED' as const;

export interface ExperimentAuthorizationPayload {
  readonly schemaVersion: typeof FOUNDER_AUTH_SCHEMA_VERSION;
  readonly domain: typeof FOUNDER_AUTH_DOMAIN;
  readonly authorizationId: string;
  readonly experimentRunId: string;
  readonly authorizationNonce: string;
  readonly founderSignerKeyId: string;
  readonly approvedBy: string;
  readonly approvedAtIso: string;
  readonly expiresAtIso: string;
  readonly stage: 'STAGE1';
  readonly manifestVersion: string;
  readonly manifestSha256: string;
  readonly datasetSha256: string;
  readonly rubricSha256: string;
  readonly selectedBriefIds: readonly string[];
  readonly modelId: string;
  readonly pricingVersion: string;
  readonly maxOutputTokensCap: number;
  readonly reasoningEffort: string;
  readonly temperature: number | null;
  readonly maxRetriesPerTrial: number;
  readonly maxBillableCalls: number;
  readonly authorizedCeilingMicroUsd: number;
  readonly permittedEnvironment: string;
  readonly providerProjectId: string;
  readonly randomSeed: string;
  readonly providerSpendingCapConfirmed: boolean;
}

export interface ExperimentAuthorizationRecord {
  readonly payload: ExperimentAuthorizationPayload;
  readonly signatureAlgorithm: 'Ed25519';
  readonly signatureBase64: string;
}

export interface FounderTrustAnchor {
  readonly signerKeyId: string;
  readonly publicKeyPem: string;
  readonly expectedPublicKeySha256: string;
  readonly source: 'operator_protected_config' | 'ephemeral_test_only';
}

export interface NonceClaimRecord {
  readonly authorizationNonce: string;
  readonly experimentRunId: string;
  readonly manifestSha256: string;
  readonly claimedAtIso: string;
  readonly finalizedAtIso?: string;
}

export interface AuthorizationNonceLedger {
  claimOrVerifyResume(args: {
    readonly authorizationNonce: string;
    readonly experimentRunId: string;
    readonly manifestSha256: string;
    readonly claimedAtIso: string;
    readonly isExplicitResume: boolean;
  }): void;
  markRunFinalized?(args: {
    readonly authorizationNonce: string;
    readonly experimentRunId: string;
    readonly finalizedAtIso: string;
  }): void;
}

export interface ProviderSpendCapEvidence {
  readonly dedicatedProjectExists: boolean;
  readonly projectId: string;
  readonly noUnrelatedWorkload: boolean;
  readonly monthlySpendLimitMicroUsd: number;
  readonly hardLimitEnforced: boolean;
  readonly remainingMonthlyBudgetMicroUsd: number;
  readonly scopedKeyProvisionedOutsideGit: boolean;
  readonly keyBelongsToProject: boolean;
  readonly containsNoSecrets: boolean;
}

const ALLOWED_ENVELOPE_KEYS = new Set<string>(['payload', 'signatureAlgorithm', 'signatureBase64']);

const ALLOWED_PAYLOAD_KEYS = new Set<string>([
  'schemaVersion',
  'domain',
  'authorizationId',
  'experimentRunId',
  'authorizationNonce',
  'founderSignerKeyId',
  'approvedBy',
  'approvedAtIso',
  'expiresAtIso',
  'stage',
  'manifestVersion',
  'manifestSha256',
  'datasetSha256',
  'rubricSha256',
  'selectedBriefIds',
  'modelId',
  'pricingVersion',
  'maxOutputTokensCap',
  'reasoningEffort',
  'temperature',
  'maxRetriesPerTrial',
  'maxBillableCalls',
  'authorizedCeilingMicroUsd',
  'permittedEnvironment',
  'providerProjectId',
  'randomSeed',
  'providerSpendingCapConfirmed',
]);

function canonicalizeValue(value: unknown, path: string): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`CANONICAL_SERIALIZATION_ERROR: non-finite number at ${path}`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, idx) => canonicalizeValue(item, `${path}[${idx}]`)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error(`CANONICAL_SERIALIZATION_ERROR: non-plain object at ${path}`);
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const entries = keys.map((key) => {
      const child = record[key];
      if (child === undefined) {
        throw new Error(`CANONICAL_SERIALIZATION_ERROR: undefined property at ${path}.${key}`);
      }
      return `${JSON.stringify(key)}:${canonicalizeValue(child, `${path}.${key}`)}`;
    });
    return `{${entries.join(',')}}`;
  }
  throw new Error(`CANONICAL_SERIALIZATION_ERROR: unsupported type "${typeof value}" at ${path}`);
}

export function canonicalizeDomainPayload(domain: string, payload: unknown): string {
  if (!domain.trim()) {
    throw new Error('CANONICAL_SERIALIZATION_ERROR: domain is required');
  }
  return `${domain}\n${canonicalizeValue(payload, '$')}`;
}

export function computePublicKeyFingerprintSha256(publicKeyPem: string): string {
  const keyObj = createPublicKey(publicKeyPem);
  if (keyObj.asymmetricKeyType !== 'ed25519') {
    throw new Error(
      `TRUST_ANCHOR_INVALID: expected ed25519 public key, received ${String(keyObj.asymmetricKeyType)}`,
    );
  }
  const spkiDer = keyObj.export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(spkiDer).digest('hex');
}

export function verifyFounderTrustAnchor(anchor: FounderTrustAnchor | null | undefined): KeyObject {
  if (!anchor) {
    throw new Error(
      `${FOUNDER_TRUST_ANCHOR_NOT_PROVISIONED}: operator-controlled Founder trust anchor is not provisioned`,
    );
  }
  if (!anchor.signerKeyId?.trim()) {
    throw new Error('TRUST_ANCHOR_INVALID: missing signerKeyId');
  }
  if (!anchor.publicKeyPem?.trim()) {
    throw new Error('TRUST_ANCHOR_INVALID: missing publicKeyPem');
  }
  if (!anchor.expectedPublicKeySha256?.trim()) {
    throw new Error('TRUST_ANCHOR_INVALID: missing expectedPublicKeySha256');
  }
  let keyObj: KeyObject;
  let actualFingerprint: string;
  try {
    keyObj = createPublicKey(anchor.publicKeyPem);
    actualFingerprint = computePublicKeyFingerprintSha256(anchor.publicKeyPem);
  } catch (err) {
    throw new Error(
      `TRUST_ANCHOR_INVALID: failed to parse Ed25519 public key (${err instanceof Error ? err.message : String(err)})`,
    );
  }
  if (actualFingerprint !== anchor.expectedPublicKeySha256) {
    throw new Error(
      `TRUST_ANCHOR_FINGERPRINT_MISMATCH: expected ${anchor.expectedPublicKeySha256}, computed ${actualFingerprint}`,
    );
  }
  return keyObj;
}

export function assertStrictAuthorizationEnvelope(
  auth: unknown,
): asserts auth is ExperimentAuthorizationRecord {
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
    throw new Error('LIVE_AUTHORIZATION_REQUIRED: authorization record must be an object');
  }
  const envelope = auth as Record<string, unknown>;
  for (const key of Object.keys(envelope)) {
    if (!ALLOWED_ENVELOPE_KEYS.has(key)) {
      throw new Error(`UNEXPECTED_AUTHORIZATION_FIELD: unexpected envelope key "${key}"`);
    }
  }
  if (envelope.signatureAlgorithm !== 'Ed25519') {
    throw new Error(
      `AUTHORIZATION_SIGNATURE_INVALID: unsupported signatureAlgorithm "${String(envelope.signatureAlgorithm)}"`,
    );
  }
  if (typeof envelope.signatureBase64 !== 'string' || !envelope.signatureBase64.trim()) {
    throw new Error('AUTHORIZATION_SIGNATURE_MISSING: missing detached Ed25519 signatureBase64');
  }
  if (!envelope.payload || typeof envelope.payload !== 'object' || Array.isArray(envelope.payload)) {
    throw new Error('LIVE_AUTHORIZATION_REQUIRED: missing authorization payload object');
  }
  const payload = envelope.payload as Record<string, unknown>;
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_PAYLOAD_KEYS.has(key)) {
      throw new Error(`UNEXPECTED_AUTHORIZATION_FIELD: unexpected payload key "${key}"`);
    }
  }
  for (const requiredKey of ALLOWED_PAYLOAD_KEYS) {
    if (!(requiredKey in payload) || payload[requiredKey] === undefined) {
      throw new Error(`AUTHORIZATION_SCHEMA_INVALID: missing required payload field "${requiredKey}"`);
    }
  }
}

export interface DeferredUsageReconciliationPayload {
  readonly domain: typeof FOUNDER_RECONCILIATION_DOMAIN;
  readonly manifestSha256: string;
  readonly trialId: string;
  readonly outputSha256: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly cachedPromptTokens?: number;
  readonly observedChargedMicroUsd?: number | null;
  readonly founderSignerKeyId: string;
  readonly reconciledAtIso: string;
}

export interface DeferredUsageReconciliationRecord {
  readonly payload: DeferredUsageReconciliationPayload;
  readonly signatureAlgorithm: 'Ed25519';
  readonly signatureBase64: string;
}

const ALLOWED_DEFERRED_RECONCILIATION_ENVELOPE_KEYS = new Set<string>([
  'payload',
  'signatureAlgorithm',
  'signatureBase64',
]);

const ALLOWED_DEFERRED_RECONCILIATION_PAYLOAD_KEYS = new Set<string>([
  'domain',
  'manifestSha256',
  'trialId',
  'outputSha256',
  'promptTokens',
  'completionTokens',
  'cachedPromptTokens',
  'observedChargedMicroUsd',
  'reconciledAtIso',
  'founderSignerKeyId',
]);

export function assertStrictDeferredReconciliationEnvelope(
  record: unknown,
): asserts record is DeferredUsageReconciliationRecord {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('DEFERRED_RECONCILIATION_INVALID: reconciliation record must be an object');
  }
  const envelope = record as Record<string, unknown>;
  for (const key of Object.keys(envelope)) {
    if (!ALLOWED_DEFERRED_RECONCILIATION_ENVELOPE_KEYS.has(key)) {
      throw new Error(`DEFERRED_RECONCILIATION_UNEXPECTED_FIELD: unexpected envelope key "${key}"`);
    }
  }
  if (envelope.signatureAlgorithm !== 'Ed25519') {
    throw new Error(
      `DEFERRED_RECONCILIATION_SIGNATURE_INVALID: unsupported signatureAlgorithm "${String(envelope.signatureAlgorithm)}"`,
    );
  }
  if (typeof envelope.signatureBase64 !== 'string' || !envelope.signatureBase64.trim()) {
    throw new Error('DEFERRED_RECONCILIATION_SIGNATURE_MISSING: missing detached Ed25519 signatureBase64');
  }
  if (!envelope.payload || typeof envelope.payload !== 'object' || Array.isArray(envelope.payload)) {
    throw new Error('DEFERRED_RECONCILIATION_INVALID: missing reconciliation payload object');
  }
  const payload = envelope.payload as Record<string, unknown>;
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_DEFERRED_RECONCILIATION_PAYLOAD_KEYS.has(key)) {
      throw new Error(`DEFERRED_RECONCILIATION_UNEXPECTED_FIELD: unexpected payload key "${key}"`);
    }
  }
  const requiredKeys = [
    'domain',
    'manifestSha256',
    'trialId',
    'outputSha256',
    'promptTokens',
    'completionTokens',
    'reconciledAtIso',
    'founderSignerKeyId',
  ];
  for (const key of requiredKeys) {
    if (!(key in payload) || payload[key] === undefined) {
      throw new Error(`DEFERRED_RECONCILIATION_SCHEMA_INVALID: missing required payload field "${key}"`);
    }
  }
  if (typeof payload.founderSignerKeyId !== 'string' || !payload.founderSignerKeyId.trim()) {
    throw new Error('DEFERRED_RECONCILIATION_SCHEMA_INVALID: founderSignerKeyId must be non-empty');
  }
  if (
    typeof payload.reconciledAtIso !== 'string' ||
    !Number.isFinite(Date.parse(payload.reconciledAtIso))
  ) {
    throw new Error('DEFERRED_RECONCILIATION_SCHEMA_INVALID: reconciledAtIso must be valid ISO-8601');
  }
}

export function verifyDetachedEd25519Signature(args: {
  readonly domain: string;
  readonly payload: unknown;
  readonly signatureBase64: string;
  readonly trustAnchor: FounderTrustAnchor | null | undefined;
  readonly expectedSignerKeyId: string;
}): { readonly canonicalPayload: string; readonly canonicalSha256: string } {
  const publicKey = verifyFounderTrustAnchor(args.trustAnchor);
  if (args.trustAnchor!.signerKeyId !== args.expectedSignerKeyId) {
    throw new Error(
      `AUTHORIZATION_SIGNER_MISMATCH: expected trusted signer "${args.trustAnchor!.signerKeyId}", got "${args.expectedSignerKeyId}"`,
    );
  }
  const sigTrimmed = args.signatureBase64.trim();
  if (!/^[A-Za-z0-9+/]+=*$/.test(sigTrimmed)) {
    throw new Error('AUTHORIZATION_SIGNATURE_MALFORMED: signatureBase64 is not valid base64');
  }
  const signatureBytes = Buffer.from(sigTrimmed, 'base64');
  if (signatureBytes.length !== 64) {
    throw new Error(
      `AUTHORIZATION_SIGNATURE_MALFORMED: Ed25519 signature must be 64 bytes, got ${signatureBytes.length}`,
    );
  }
  const canonicalPayload = canonicalizeDomainPayload(args.domain, args.payload);
  const valid = verify(null, Buffer.from(canonicalPayload, 'utf8'), publicKey, signatureBytes);
  if (!valid) {
    throw new Error('AUTHORIZATION_SIGNATURE_INVALID: Ed25519 signature verification failed');
  }
  const canonicalSha256 = createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
  return { canonicalPayload, canonicalSha256 };
}

export class InMemoryAuthorizationNonceLedger implements AuthorizationNonceLedger {
  private readonly claims = new Map<string, NonceClaimRecord>();

  claimOrVerifyResume(args: {
    readonly authorizationNonce: string;
    readonly experimentRunId: string;
    readonly manifestSha256: string;
    readonly claimedAtIso: string;
    readonly isExplicitResume: boolean;
  }): void {
    const existing = this.claims.get(args.authorizationNonce);
    if (args.isExplicitResume) {
      if (!existing) {
        throw new Error(
          `AUTHORIZATION_RESUME_UNCLAIMED_NONCE: cannot resume unknown nonce "${args.authorizationNonce}"`,
        );
      }
      if (existing.finalizedAtIso) {
        throw new Error(
          `AUTHORIZATION_RESUME_ALREADY_FINALIZED: nonce "${args.authorizationNonce}" was finalized at "${existing.finalizedAtIso}"`,
        );
      }
      if (
        existing.experimentRunId !== args.experimentRunId ||
        existing.manifestSha256 !== args.manifestSha256
      ) {
        throw new Error(
          `AUTHORIZATION_RESUME_MISMATCH: nonce "${args.authorizationNonce}" belongs to run "${existing.experimentRunId}"`,
        );
      }
      return;
    }
    if (existing) {
      throw new Error(
        `AUTHORIZATION_NONCE_REPLAY: nonce "${args.authorizationNonce}" already consumed by run "${existing.experimentRunId}"`,
      );
    }
    this.claims.set(args.authorizationNonce, {
      authorizationNonce: args.authorizationNonce,
      experimentRunId: args.experimentRunId,
      manifestSha256: args.manifestSha256,
      claimedAtIso: args.claimedAtIso,
    });
  }

  markRunFinalized(args: {
    readonly authorizationNonce: string;
    readonly experimentRunId: string;
    readonly finalizedAtIso: string;
  }): void {
    const existing = this.claims.get(args.authorizationNonce);
    if (!existing || existing.experimentRunId !== args.experimentRunId) {
      return;
    }
    this.claims.set(args.authorizationNonce, {
      ...existing,
      finalizedAtIso: args.finalizedAtIso,
    });
  }
}

export class FileAuthorizationNonceLedger implements AuthorizationNonceLedger {
  constructor(private readonly ledgerDir: string) {
    if (!ledgerDir.trim()) {
      throw new Error('NONCE_LEDGER_INVALID: ledgerDir is required');
    }
  }

  private getClaimPath(authorizationNonce: string): string {
    const hash = createHash('sha256').update(authorizationNonce, 'utf8').digest('hex');
    return join(this.ledgerDir, `${hash}.json`);
  }

  claimOrVerifyResume(args: {
    readonly authorizationNonce: string;
    readonly experimentRunId: string;
    readonly manifestSha256: string;
    readonly claimedAtIso: string;
    readonly isExplicitResume: boolean;
  }): void {
    if (!existsSync(this.ledgerDir)) {
      mkdirSync(this.ledgerDir, { recursive: true });
    }
    const claimPath = this.getClaimPath(args.authorizationNonce);
    const record: NonceClaimRecord = {
      authorizationNonce: args.authorizationNonce,
      experimentRunId: args.experimentRunId,
      manifestSha256: args.manifestSha256,
      claimedAtIso: args.claimedAtIso,
    };
    if (args.isExplicitResume) {
      if (!existsSync(claimPath)) {
        throw new Error(
          `AUTHORIZATION_RESUME_UNCLAIMED_NONCE: cannot resume unknown nonce "${args.authorizationNonce}"`,
        );
      }
      const existing = JSON.parse(readFileSync(claimPath, 'utf8')) as NonceClaimRecord;
      if (existing.finalizedAtIso) {
        throw new Error(
          `AUTHORIZATION_RESUME_ALREADY_FINALIZED: nonce "${args.authorizationNonce}" was finalized at "${existing.finalizedAtIso}"`,
        );
      }
      if (
        existing.authorizationNonce !== args.authorizationNonce ||
        existing.experimentRunId !== args.experimentRunId ||
        existing.manifestSha256 !== args.manifestSha256
      ) {
        throw new Error(
          `AUTHORIZATION_RESUME_MISMATCH: nonce "${args.authorizationNonce}" belongs to run "${existing.experimentRunId}"`,
        );
      }
      return;
    }
    try {
      writeFileSync(claimPath, JSON.stringify(record), { encoding: 'utf8', flag: 'wx' });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') {
        throw new Error(
          `AUTHORIZATION_NONCE_REPLAY: nonce "${args.authorizationNonce}" already consumed`,
        );
      }
      throw err;
    }
  }

  markRunFinalized(args: {
    readonly authorizationNonce: string;
    readonly experimentRunId: string;
    readonly finalizedAtIso: string;
  }): void {
    const claimPath = this.getClaimPath(args.authorizationNonce);
    if (!existsSync(claimPath)) {
      return;
    }
    const existing = JSON.parse(readFileSync(claimPath, 'utf8')) as NonceClaimRecord;
    if (existing.experimentRunId !== args.experimentRunId) {
      return;
    }
    writeFileSync(
      claimPath,
      JSON.stringify({ ...existing, finalizedAtIso: args.finalizedAtIso }),
      { encoding: 'utf8' },
    );
  }
}

export function evaluateProviderCapBoundary(args: {
  readonly evidence: ProviderSpendCapEvidence | null | undefined;
  readonly expectedProjectId: string;
  readonly requiredBudgetMicroUsd: number;
}): { readonly status: 'VERIFIED' | typeof PROVIDER_CAP_UNVERIFIED; readonly reasons: readonly string[] } {
  const e = args.evidence;
  if (!e) {
    return { status: PROVIDER_CAP_UNVERIFIED, reasons: ['provider_spend_cap_evidence_absent'] };
  }
  const reasons: string[] = [];
  if (!e.dedicatedProjectExists) reasons.push('dedicated_project_not_verified');
  if (!e.projectId.trim() || e.projectId !== args.expectedProjectId) {
    reasons.push('project_id_mismatch');
  }
  if (!e.noUnrelatedWorkload) reasons.push('unrelated_workload_not_ruled_out');
  if (!Number.isSafeInteger(e.monthlySpendLimitMicroUsd) || e.monthlySpendLimitMicroUsd <= 0) {
    reasons.push('monthly_spend_limit_missing');
  }
  if (!e.hardLimitEnforced) reasons.push('hard_limit_not_enforced');
  if (
    !Number.isSafeInteger(e.remainingMonthlyBudgetMicroUsd) ||
    e.remainingMonthlyBudgetMicroUsd < args.requiredBudgetMicroUsd
  ) {
    reasons.push('remaining_monthly_budget_insufficient');
  }
  if (!e.scopedKeyProvisionedOutsideGit) reasons.push('scoped_key_outside_git_unverified');
  if (!e.keyBelongsToProject) reasons.push('key_project_binding_unverified');
  if (!e.containsNoSecrets) reasons.push('evidence_contains_secrets_flag_false');
  return reasons.length === 0
    ? { status: 'VERIFIED', reasons: [] }
    : { status: PROVIDER_CAP_UNVERIFIED, reasons };
}

/**
 * Ephemeral in-memory Ed25519 keypair generator strictly for offline automated tests.
 * Never persists private key material to disk or logs.
 */
export function createEphemeralTestFounderKeypair(signerKeyId = 'test-founder-ed25519-v1'): {
  readonly trustAnchor: FounderTrustAnchor;
  readonly signAuthorization: (payload: ExperimentAuthorizationPayload) => ExperimentAuthorizationRecord;
  readonly signDomainPayload: (domain: string, payload: unknown) => string;
} {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const expectedPublicKeySha256 = computePublicKeyFingerprintSha256(publicKeyPem);
  const trustAnchor: FounderTrustAnchor = {
    signerKeyId,
    publicKeyPem,
    expectedPublicKeySha256,
    source: 'ephemeral_test_only',
  };
  const signDomainPayload = (domain: string, payload: unknown): string => {
    const canonical = canonicalizeDomainPayload(domain, payload);
    return sign(null, Buffer.from(canonical, 'utf8'), privateKey).toString('base64');
  };
  const signAuthorization = (
    payload: ExperimentAuthorizationPayload,
  ): ExperimentAuthorizationRecord => ({
    payload,
    signatureAlgorithm: 'Ed25519',
    signatureBase64: signDomainPayload(payload.domain, payload),
  });
  return { trustAnchor, signAuthorization, signDomainPayload };
}
