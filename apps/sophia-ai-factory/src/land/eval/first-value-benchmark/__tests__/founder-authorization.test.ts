/**
 * Adversarial security tests for cryptographic Founder authorization (Ed25519),
 * canonical payload signing, single-use nonce replay protection, explicit resume policy,
 * and external provider spend-cap boundary preservation.
 *
 * Uses ephemeral in-memory Ed25519 keys ONLY — zero real credentials, zero network calls.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertLiveAuthorization,
  canonicalizeDomainPayload,
  computeStage1ManifestSha256,
  createDeterministicMockTransport,
  createEphemeralTestFounderKeypair,
  evaluateProviderCapBoundary,
  FileAuthorizationNonceLedger,
  FOUNDER_AUTH_DOMAIN,
  FOUNDER_AUTH_SCHEMA_VERSION,
  InMemoryAuthorizationNonceLedger,
  installBenchmarkZeroNetworkGuard,
  PINNED_MODEL_CONTRACTS,
  STAGE1_EXPERIMENTAL_CONFIG,
  verifyFrozenDataset,
  verifyFrozenRubric,
  verifyStage1CalibrationManifest,
  type ExperimentAuthorizationPayload,
  type ExperimentAuthorizationRecord,
  type Stage1CalibrationManifest,
  type ZeroNetworkGuardHandle,
} from '../index';

const EVAL_DIR = path.resolve(process.cwd(), 'eval/b4-first-value');
const CONTRACT = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];
const NOW_ISO = '2026-11-23T12:00:00.000Z';

function loadStage1() {
  const datasetRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-v1.jsonl'), 'utf8');
  const manifestRaw = fs.readFileSync(path.join(EVAL_DIR, 'dataset-manifest.json'), 'utf8');
  const rubricRaw = fs.readFileSync(path.join(EVAL_DIR, 'rubric-v1.json'), 'utf8');
  const stage1Raw = fs.readFileSync(path.join(EVAL_DIR, 'stage1-calibration-manifest-v1.json'), 'utf8');
  const dataset = verifyFrozenDataset(datasetRaw, manifestRaw);
  verifyFrozenRubric(rubricRaw, dataset.manifest.rubricSha256);
  return verifyStage1CalibrationManifest(stage1Raw, dataset.briefs, dataset.manifest);
}

function buildValidPayload(
  manifest: Stage1CalibrationManifest,
  signerKeyId: string,
  overrides?: Partial<ExperimentAuthorizationPayload>,
): ExperimentAuthorizationPayload {
  return {
    schemaVersion: FOUNDER_AUTH_SCHEMA_VERSION,
    domain: FOUNDER_AUTH_DOMAIN,
    authorizationId: 'ADV-AUTH-001',
    experimentRunId: 'run-adv-stage1-001',
    authorizationNonce: 'nonce-adv-001',
    founderSignerKeyId: signerKeyId,
    approvedBy: 'founder-test',
    approvedAtIso: '2026-11-23T00:00:00.000Z',
    expiresAtIso: '2026-11-24T00:00:00.000Z',
    stage: 'STAGE1',
    manifestVersion: manifest.protocolVersion,
    manifestSha256: computeStage1ManifestSha256(manifest),
    datasetSha256: manifest.datasetSha256,
    rubricSha256: manifest.rubricSha256,
    randomSeed: manifest.randomSeed,
    selectedBriefIds: [...manifest.selectedBriefIds],
    modelId: CONTRACT.modelId,
    pricingVersion: CONTRACT.pricingVersion,
    maxOutputTokensCap: STAGE1_EXPERIMENTAL_CONFIG.stage1MaxOutputTokensCap,
    reasoningEffort: STAGE1_EXPERIMENTAL_CONFIG.stage1ReasoningEffort,
    temperature: STAGE1_EXPERIMENTAL_CONFIG.stage1Temperature,
    maxRetriesPerTrial: manifest.callGraphPlan.maxRetriesPerTrial,
    authorizedCeilingMicroUsd: manifest.callGraphPlan.proposedSpendCeilingMicroUsd,
    maxBillableCalls: manifest.callGraphPlan.runMaxBillableCallsCeiling,
    permittedEnvironment: 'offline_test_harness',
    providerProjectId: 'proj_test_stage1_dedicated',
    providerSpendingCapConfirmed: true,
    ...overrides,
  };
}

describe('Cryptographic Founder Authorization Adversarial Suite (25 Mandatory Cases)', () => {
  const founder = createEphemeralTestFounderKeypair('founder-ephemeral-key-v1');
  const attacker = createEphemeralTestFounderKeypair('founder-ephemeral-key-v1');
  const transport = createDeterministicMockTransport(CONTRACT);
  let networkGuard: ZeroNetworkGuardHandle | null = null;
  let tempDirs: string[] = [];

  beforeEach(() => {
    networkGuard = installBenchmarkZeroNetworkGuard();
    tempDirs = [];
  });

  afterEach(() => {
    networkGuard?.restore();
    networkGuard = null;
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function baseArgs(stage1: ReturnType<typeof loadStage1>) {
    return {
      liveExecutionEnabled: true,
      manifest: stage1.manifest,
      selectedBriefs: stage1.selectedBriefs,
      contract: CONTRACT,
      maxOutputTokensCap: STAGE1_EXPERIMENTAL_CONFIG.stage1MaxOutputTokensCap,
      nowIso: NOW_ISO,
      trustAnchor: founder.trustAnchor,
      expectedPermittedEnvironment: 'offline_test_harness',
      expectedProviderProjectId: 'proj_test_stage1_dedicated',
      nonceLedger: new InMemoryAuthorizationNonceLedger(),
      liveTransport: transport,
    };
  }

  it('produces deterministic canonical bytes regardless of object key insertion order', () => {
    const a = canonicalizeDomainPayload('test-domain', { z: 1, a: { c: 3, b: 2 } });
    const b = canonicalizeDomainPayload('test-domain', { a: { b: 2, c: 3 }, z: 1 });
    expect(a).toBe(b);
  });

  it('1. accepts a valid Ed25519-signed authorization matching the exact manifest and parameters', () => {
    const stage1 = loadStage1();
    const payload = buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId);
    const auth = founder.signAuthorization(payload);

    const snapshot = assertLiveAuthorization({
      ...baseArgs(stage1),
      authorization: auth,
    });

    expect(snapshot.authorization?.payload.experimentRunId).toBe(payload.experimentRunId);
    expect(snapshot.experimentRunId).toBe(payload.experimentRunId);
    expect(snapshot.authorizationDigestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('2. rejects unsigned authorization objects', () => {
    const stage1 = loadStage1();
    const payload = buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId);
    const unsigned = {
      payload,
      signatureAlgorithm: 'Ed25519',
      signatureBase64: '',
    } as unknown as ExperimentAuthorizationRecord;

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: unsigned }),
    ).toThrow(/SIGNATURE|MALFORMED|INVALID/);
  });

  it('3. rejects forged approvedBy="Founder" / spendingAuthorized=true without valid signature', () => {
    const stage1 = loadStage1();
    const forged = {
      approvedBy: 'Founder',
      spendingAuthorized: true,
      authorizationId: 'FORGED-SELF-APPROVAL',
    } as unknown as ExperimentAuthorizationRecord;

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: forged }),
    ).toThrow(/UNEXPECTED_AUTHORIZATION_FIELD|INVALID_AUTHORIZATION/);
  });

  it('4. rejects authorization signed by an attacker-generated Ed25519 key', () => {
    const stage1 = loadStage1();
    const payload = buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId);
    const attackerSigned = attacker.signAuthorization(payload);

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: attackerSigned }),
    ).toThrow(/SIGNATURE_INVALID/);
  });

  it('5. rejects authorization when manifest digest is changed after signing or mismatches manifest', () => {
    const stage1 = loadStage1();
    const payload = buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId);
    const signed = founder.signAuthorization(payload);
    const tampered: ExperimentAuthorizationRecord = {
      ...signed,
      payload: { ...signed.payload, manifestSha256: '0'.repeat(64) },
    };

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: tampered }),
    ).toThrow(/SIGNATURE_INVALID/);

    const wrongManifestSigned = founder.signAuthorization({
      ...payload,
      manifestSha256: '0'.repeat(64),
    });
    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: wrongManifestSigned }),
    ).toThrow(/LIVE_AUTHORIZATION_MANIFEST_MISMATCH/);
  });

  it('6. rejects authorization with a changed dataset SHA-256', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        datasetSha256: 'f'.repeat(64),
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_DATASET_MISMATCH/);
  });

  it('7. rejects authorization with a changed model ID', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        modelId: 'gpt-5.4-2026-03-17',
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_MODEL_MISMATCH/);
  });

  it('8. rejects authorization with an increased USD spend ceiling', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        authorizedCeilingMicroUsd: stage1.manifest.callGraphPlan.proposedSpendCeilingMicroUsd + 1_000_000,
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_CEILING_INVALID/);
  });

  it('9. rejects authorization with an increased billable call ceiling', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        maxBillableCalls: stage1.manifest.callGraphPlan.runMaxBillableCallsCeiling + 10,
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_CALL_CEILING_INVALID/);
  });

  it('10. rejects authorization with a changed retry limit', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        maxRetriesPerTrial: stage1.manifest.callGraphPlan.maxRetriesPerTrial + 1,
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_RETRY_POLICY_MISMATCH/);
  });

  it('11. rejects authorization with a changed max output token limit', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        maxOutputTokensCap: STAGE1_EXPERIMENTAL_CONFIG.stage1MaxOutputTokensCap + 500,
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_TOKEN_CAP_MISMATCH/);
  });

  it('12. rejects authorization with changed selected brief IDs', () => {
    const stage1 = loadStage1();
    const alteredBriefs = [...stage1.manifest.selectedBriefIds];
    alteredBriefs[0] = 'brief-tampered-999';
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        selectedBriefIds: alteredBriefs,
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_BRIEFS_MISMATCH/);
  });

  it('13. rejects expired authorization', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        approvedAtIso: '2026-11-21T00:00:00.000Z',
        expiresAtIso: '2026-11-22T00:00:00.000Z',
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_EXPIRED/);
  });

  it('14. rejects future-dated invalid approval', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        approvedAtIso: '2026-11-23T15:00:00.000Z',
        expiresAtIso: '2026-11-24T15:00:00.000Z',
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_FUTURE_DATED/);
  });

  it('15. rejects authorization reused for Stage 2', () => {
    const stage1 = loadStage1();
    const stage2Payload = {
      ...buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId),
      stage: 'STAGE2',
    } as unknown as ExperimentAuthorizationPayload;
    const signed = founder.signAuthorization(stage2Payload);

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/STAGE/);
  });

  it('16. rejects reusing an authorization nonce for a different experiment run', () => {
    const stage1 = loadStage1();
    const ledger = new InMemoryAuthorizationNonceLedger();
    const authRun1 = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        experimentRunId: 'run-alpha-001',
        authorizationNonce: 'shared-nonce-xyz',
      }),
    );
    const authRun2 = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        experimentRunId: 'run-beta-002',
        authorizationNonce: 'shared-nonce-xyz',
      }),
    );

    assertLiveAuthorization({ ...baseArgs(stage1), authorization: authRun1, nonceLedger: ledger });

    expect(() =>
      assertLiveAuthorization({
        ...baseArgs(stage1),
        authorization: authRun2,
        nonceLedger: ledger,
        isExplicitResume: true,
      }),
    ).toThrow(/AUTHORIZATION_RESUME_MISMATCH/);
  });

  it('17. rejects authorization with wrong signer key ID', () => {
    const stage1 = loadStage1();
    const otherKeypair = createEphemeralTestFounderKeypair('founder-wrong-key-id');
    const signed = otherKeypair.signAuthorization(
      buildValidPayload(stage1.manifest, 'founder-wrong-key-id'),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/AUTHORIZATION_SIGNER_MISMATCH/);
  });

  it('18. rejects when trusted Founder public key anchor is missing (FOUNDER_TRUST_ANCHOR_NOT_PROVISIONED)', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId),
    );

    expect(() =>
      assertLiveAuthorization({
        ...baseArgs(stage1),
        trustAnchor: null,
        authorization: signed,
      }),
    ).toThrow(/FOUNDER_TRUST_ANCHOR_NOT_PROVISIONED/);
  });

  it('19. rejects malformed Ed25519 signature bytes', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId),
    );
    const malformed: ExperimentAuthorizationRecord = {
      ...signed,
      signatureBase64: 'not-valid-base64-64-bytes!!!',
    };

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: malformed }),
    ).toThrow(/SIGNATURE_MALFORMED|SIGNATURE_INVALID/);
  });

  it('20. rejects authorization with changed provider project ID', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        providerProjectId: 'proj_unrelated_prod_project',
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_PROJECT_MISMATCH/);
  });

  it('21. rejects authorization with changed pricing version', () => {
    const stage1 = loadStage1();
    const signed = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        pricingVersion: 'openai-gpt54mini-2099-01-01',
      }),
    );

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: signed }),
    ).toThrow(/LIVE_AUTHORIZATION_MODEL_MISMATCH/);
  });

  it('22. rejects duplicate nonce replay across both in-memory and atomic file-backed nonce ledgers', () => {
    const stage1 = loadStage1();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-nonce-ledger-'));
    tempDirs.push(tmpDir);
    const fileLedger = new FileAuthorizationNonceLedger(tmpDir);

    const auth = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        experimentRunId: 'run-file-ledger-001',
        authorizationNonce: 'nonce-single-use-001',
      }),
    );

    assertLiveAuthorization({ ...baseArgs(stage1), authorization: auth, nonceLedger: fileLedger });

    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: auth, nonceLedger: fileLedger }),
    ).toThrow(/NONCE_REPLAY|NONCE_ALREADY_CONSUMED/);

    const freshLedger = new FileAuthorizationNonceLedger(tmpDir);
    expect(() =>
      assertLiveAuthorization({ ...baseArgs(stage1), authorization: auth, nonceLedger: freshLedger }),
    ).toThrow(/NONCE_REPLAY|NONCE_ALREADY_CONSUMED/);
  });

  it('23. accepts valid resume under the same authorized run ID ONLY under explicit resume policy', () => {
    const stage1 = loadStage1();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-nonce-resume-'));
    tempDirs.push(tmpDir);
    const fileLedger = new FileAuthorizationNonceLedger(tmpDir);

    const auth = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        experimentRunId: 'run-resumable-001',
        authorizationNonce: 'nonce-resumable-001',
      }),
    );

    assertLiveAuthorization({ ...baseArgs(stage1), authorization: auth, nonceLedger: fileLedger });

    expect(() =>
      assertLiveAuthorization({
        ...baseArgs(stage1),
        authorization: auth,
        nonceLedger: fileLedger,
        isExplicitResume: false,
      }),
    ).toThrow(/NONCE_REPLAY|NONCE_ALREADY_CONSUMED/);

    const resumedSnapshot = assertLiveAuthorization({
      ...baseArgs(stage1),
      authorization: auth,
      nonceLedger: fileLedger,
      isExplicitResume: true,
    });
    expect(resumedSnapshot.authorization?.payload.experimentRunId).toBe('run-resumable-001');
  });

  it('24. rejects attempts to bypass verification via environment variables', () => {
    const stage1 = loadStage1();
    const savedEnv = {
      SOPHIA_SKIP_FOUNDER_AUTH: process.env.SOPHIA_SKIP_FOUNDER_AUTH,
      FOUNDER_AUTH_BYPASS: process.env.FOUNDER_AUTH_BYPASS,
      SPENDING_AUTHORIZED: process.env.SPENDING_AUTHORIZED,
    };
    try {
      process.env.SOPHIA_SKIP_FOUNDER_AUTH = 'true';
      process.env.FOUNDER_AUTH_BYPASS = '1';
      process.env.SPENDING_AUTHORIZED = 'true';

      const signed = founder.signAuthorization(
        buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId),
      );
      expect(() =>
        assertLiveAuthorization({
          ...baseArgs(stage1),
          trustAnchor: null,
          authorization: signed,
        }),
      ).toThrow(/FOUNDER_TRUST_ANCHOR_NOT_PROVISIONED/);
    } finally {
      for (const [key, val] of Object.entries(savedEnv)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
    }
  });

  it('25. rejects attempts to supply a replacement public key inside the authorization payload or envelope', () => {
    const stage1 = loadStage1();
    const payloadWithInjectedKey = {
      ...buildValidPayload(stage1.manifest, attacker.trustAnchor.signerKeyId),
      publicKeyPem: attacker.trustAnchor.publicKeyPem,
    } as unknown as ExperimentAuthorizationPayload;
    const signedWithInjectedPayloadKey = attacker.signAuthorization(payloadWithInjectedKey);

    expect(() =>
      assertLiveAuthorization({
        ...baseArgs(stage1),
        authorization: signedWithInjectedPayloadKey,
      }),
    ).toThrow(/UNEXPECTED_AUTHORIZATION_FIELD/);

    const envelopeWithInjectedKey = {
      ...founder.signAuthorization(
        buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId),
      ),
      publicKeyPem: attacker.trustAnchor.publicKeyPem,
    } as unknown as ExperimentAuthorizationRecord;

    expect(() =>
      assertLiveAuthorization({
        ...baseArgs(stage1),
        authorization: envelopeWithInjectedKey,
      }),
    ).toThrow(/UNEXPECTED_AUTHORIZATION_FIELD/);
  });

  it('rejects live authorization when nonceLedger is omitted (fail-closed replay protection)', () => {
    const stage1 = loadStage1();
    const auth = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId),
    );
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs(stage1),
        authorization: auth,
        nonceLedger: undefined,
      }),
    ).toThrow(/LIVE_AUTHORIZATION_NONCE_LEDGER_REQUIRED/);
  });

  it('rejects live authorization when permittedEnvironment does not match expectedPermittedEnvironment', () => {
    const stage1 = loadStage1();
    const auth = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        permittedEnvironment: 'wrong_environment',
      }),
    );
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs(stage1),
        authorization: auth,
        expectedPermittedEnvironment: 'offline_test_harness',
      }),
    ).toThrow(/LIVE_AUTHORIZATION_ENVIRONMENT_MISMATCH/);
  });

  it('rejects authorization with null temperature when manifest specifies a numeric temperature', () => {
    const stage1 = loadStage1();
    const auth = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        temperature: null,
      }),
    );
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs(stage1),
        authorization: auth,
      }),
    ).toThrow(/LIVE_AUTHORIZATION_TEMPERATURE_MISMATCH/);
  });

  it('rejects resume after a run has been marked finalized in both in-memory and file nonce ledgers', () => {
    const stage1 = loadStage1();
    const memLedger = new InMemoryAuthorizationNonceLedger();
    const auth = founder.signAuthorization(
      buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
        experimentRunId: 'run-finalized-001',
        authorizationNonce: 'nonce-finalized-001',
      }),
    );
    assertLiveAuthorization({ ...baseArgs(stage1), authorization: auth, nonceLedger: memLedger });
    memLedger.markRunFinalized({
      authorizationNonce: auth.payload.authorizationNonce,
      experimentRunId: auth.payload.experimentRunId,
      finalizedAtIso: '2026-11-23T13:00:00.000Z',
    });
    expect(() =>
      assertLiveAuthorization({
        ...baseArgs(stage1),
        authorization: auth,
        nonceLedger: memLedger,
        isExplicitResume: true,
      }),
    ).toThrow(/AUTHORIZATION_RESUME_ALREADY_FINALIZED/);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-nonce-finalized-'));
    try {
      const fileLedger = new FileAuthorizationNonceLedger(dir);
      const fileAuth = founder.signAuthorization(
        buildValidPayload(stage1.manifest, founder.trustAnchor.signerKeyId, {
          experimentRunId: 'run-finalized-file-001',
          authorizationNonce: 'nonce-finalized-file-001',
        }),
      );
      assertLiveAuthorization({
        ...baseArgs(stage1),
        authorization: fileAuth,
        nonceLedger: fileLedger,
      });
      fileLedger.markRunFinalized({
        authorizationNonce: fileAuth.payload.authorizationNonce,
        experimentRunId: fileAuth.payload.experimentRunId,
        finalizedAtIso: '2026-11-23T13:00:00.000Z',
      });
      expect(() =>
        assertLiveAuthorization({
          ...baseArgs(stage1),
          authorization: fileAuth,
          nonceLedger: fileLedger,
          isExplicitResume: true,
        }),
      ).toThrow(/AUTHORIZATION_RESUME_ALREADY_FINALIZED/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('External Provider Account Spend-Cap Boundary Preservation', () => {
  it('preserves PROVIDER_CAP_UNVERIFIED when operator evidence is absent', () => {
    const verdict = evaluateProviderCapBoundary({
      evidence: null,
      expectedProjectId: 'proj_test_stage1_dedicated',
      requiredBudgetMicroUsd: 3_000_000,
    });
    expect(verdict.status).toBe('PROVIDER_CAP_UNVERIFIED');
    expect(verdict.reasons).toContain('provider_spend_cap_evidence_absent');
  });

  it('preserves PROVIDER_CAP_UNVERIFIED when hard limit, project match, or secret hygiene fails', () => {
    const verdict = evaluateProviderCapBoundary({
      evidence: {
        dedicatedProjectExists: true,
        projectId: 'proj_wrong_project',
        noUnrelatedWorkload: true,
        monthlySpendLimitMicroUsd: 3_000_000,
        hardLimitEnforced: false,
        remainingMonthlyBudgetMicroUsd: 3_000_000,
        scopedKeyProvisionedOutsideGit: true,
        keyBelongsToProject: true,
        containsNoSecrets: false,
      },
      expectedProjectId: 'proj_test_stage1_dedicated',
      requiredBudgetMicroUsd: 3_000_000,
    });
    expect(verdict.status).toBe('PROVIDER_CAP_UNVERIFIED');
    expect(verdict.reasons).toContain('project_id_mismatch');
    expect(verdict.reasons).toContain('hard_limit_not_enforced');
    expect(verdict.reasons).toContain('evidence_contains_secrets_flag_false');
  });

  it('returns VERIFIED only when all non-secret operator spend-cap controls pass', () => {
    const verdict = evaluateProviderCapBoundary({
      evidence: {
        dedicatedProjectExists: true,
        projectId: 'proj_test_stage1_dedicated',
        noUnrelatedWorkload: true,
        monthlySpendLimitMicroUsd: 3_000_000,
        hardLimitEnforced: true,
        remainingMonthlyBudgetMicroUsd: 3_000_000,
        scopedKeyProvisionedOutsideGit: true,
        keyBelongsToProject: true,
        containsNoSecrets: true,
      },
      expectedProjectId: 'proj_test_stage1_dedicated',
      requiredBudgetMicroUsd: 3_000_000,
    });
    expect(verdict.status).toBe('VERIFIED');
    expect(verdict.reasons).toEqual([]);
  });
});
