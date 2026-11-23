import { describe, expect, it } from 'vitest';
import {
  ExperimentCostGovernor,
  PINNED_MODEL_CONTRACTS,
  type CostGovernorConfig,
} from '../index';

const OPENAI_CONTRACT = PINNED_MODEL_CONTRACTS['gpt-5.4-mini-2026-03-17'];

function makeConfig(overrides?: Partial<CostGovernorConfig>): CostGovernorConfig {
  return {
    plannedLogicalTrials: 20,
    plannedProviderCalls: 20,
    maxBillableCalls: 30,
    maxRetriesPerTrial: 1,
    maxPromptTokensBudget: 4000,
    maxOutputTokensCap: 1200,
    authorizedCeilingMicroUsd: 3_000_000,
    spendingAuthorized: true,
    providerSpendingCapConfirmed: true,
    pricingContract: OPENAI_CONTRACT,
    ...overrides,
  };
}

describe('ExperimentCostGovernor local failure-injection suite', () => {
  it('fails closed when spending is unauthorized, provider spending cap is unconfirmed, price changed, model is unknown, or pricing is missing', () => {
    const unauth = new ExperimentCostGovernor(makeConfig({ spendingAuthorized: false }));
    expect(
      unauth.admitCall({
        trialId: 't1',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 1000,
      }),
    ).toMatchObject({ admitted: false, code: 'SPENDING_NOT_AUTHORIZED' });

    const noProviderCap = new ExperimentCostGovernor(makeConfig({ providerSpendingCapConfirmed: false }));
    expect(
      noProviderCap.admitCall({
        trialId: 't1',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 1000,
      }),
    ).toMatchObject({ admitted: false, code: 'PROVIDER_SPEND_CAP_NOT_CONFIRMED' });

    const missingPrice = new ExperimentCostGovernor(makeConfig({ pricingContract: null }));
    expect(
      missingPrice.admitCall({
        trialId: 't1',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 1000,
      }),
    ).toMatchObject({ admitted: false, code: 'MISSING_MODEL_PRICING' });

    const gov = new ExperimentCostGovernor(makeConfig());
    expect(
      gov.admitCall({
        trialId: 't1',
        attemptNumber: 1,
        modelId: 'gpt-5.4-mini-2026-03-17',
        pricingVersion: 'openai-2026-12-01-changed',
        promptTokensEstimate: 500,
        maxOutputTokens: 1000,
      }),
    ).toMatchObject({ admitted: false, code: 'PRICING_VERSION_MISMATCH' });

    expect(
      gov.admitCall({
        trialId: 't1',
        attemptNumber: 1,
        modelId: 'unknown-model-v9',
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 1000,
      }),
    ).toMatchObject({ admitted: false, code: 'UNKNOWN_MODEL' });
  });

  it('rejects prompt token budget overflow, output token cap overflow, and remaining budget below reservation', () => {
    const gov = new ExperimentCostGovernor(makeConfig({ authorizedCeilingMicroUsd: 5000 }));

    expect(
      gov.admitCall({
        trialId: 't1',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 4001,
        maxOutputTokens: 1000,
      }),
    ).toMatchObject({ admitted: false, code: 'PROMPT_TOKEN_BUDGET_EXCEEDED' });

    expect(
      gov.admitCall({
        trialId: 't1',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 1201,
      }),
    ).toMatchObject({ admitted: false, code: 'OUTPUT_TOKEN_CAP_EXCEEDED' });

    // Conservative reservation for 1000 input + 1200 output on gpt-5.4-mini = 750 + 5400 = 6150 > 5000 ceiling
    expect(
      gov.admitCall({
        trialId: 't1',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 1000,
        maxOutputTokens: 1200,
      }),
    ).toMatchObject({ admitted: false, code: 'BUDGET_CEILING_EXCEEDED' });
  });

  it('handles retry after 429, actual vs estimated usage variance, concurrent admission, and duplicate logical trial', () => {
    const gov = new ExperimentCostGovernor(makeConfig());

    const first = gov.admitCall({
      trialId: 'trial-1',
      attemptNumber: 1,
      modelId: OPENAI_CONTRACT.modelId,
      pricingVersion: OPENAI_CONTRACT.pricingVersion,
      promptTokensEstimate: 1000,
      maxOutputTokens: 1000,
    });
    expect(first.admitted).toBe(true);
    if (!first.admitted) return;

    // Concurrent admission rejected while first call is in flight
    expect(
      gov.admitCall({
        trialId: 'trial-2',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 1000,
        maxOutputTokens: 1000,
      }),
    ).toMatchObject({ admitted: false, code: 'CONCURRENT_CALL_NOT_ALLOWED' });

    // Pre-acceptance 429 failure releases reservation cleanly
    gov.reconcileFailure(first.admissionId, {
      acceptedByProvider: false,
      httpStatus: 429,
      reason: 'rate_limited',
    });
    expect(gov.exportSnapshot().reservedMicroUsd).toBe(0);
    expect(gov.exportSnapshot().uncertainLiabilityMicroUsd).toBe(0);

    // Retry passes admission control and reconciles actual usage differing from conservative estimate
    const retry = gov.admitCall({
      trialId: 'trial-1',
      attemptNumber: 2,
      modelId: OPENAI_CONTRACT.modelId,
      pricingVersion: OPENAI_CONTRACT.pricingVersion,
      promptTokensEstimate: 1000,
      maxOutputTokens: 1000,
    });
    expect(retry.admitted).toBe(true);
    if (!retry.admitted) return;

    const rec = gov.reconcileSuccess(retry.admissionId, {
      promptTokens: 600,
      completionTokens: 400,
    });
    // 600 * 0.75 + 400 * 4.5 = 450 + 1800 = 2250 microUSD (vs 5250 reserved)
    expect(rec.observedCostMicroUsd).toBe(2250);
    expect(rec.reservationDeltaMicroUsd).toBe(-3000);
    const snap = gov.exportSnapshot();
    expect(snap.retryCount).toBe(1);
    expect(snap.actualSpendMicroUsd).toBe(2250);
    expect(snap.reservedMicroUsd).toBe(0);
    expect(snap.spendEvidenceStatus).toBe('COMPLETE');

    // Duplicate logical trial rejected after completion
    expect(
      gov.admitCall({
        trialId: 'trial-1',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 500,
      }),
    ).toMatchObject({ admitted: false, code: 'DUPLICATE_LOGICAL_TRIAL' });
  });

  it('retains uncertain liability on timeout-after-accept and missing usage metadata, and supports partial-run resume', () => {
    // 1. Timeout after provider acceptance retains conservative reservation and halts further calls
    const govTimeout = new ExperimentCostGovernor(makeConfig());
    const lease1 = govTimeout.admitCall({
      trialId: 'trial-timeout',
      attemptNumber: 1,
      modelId: OPENAI_CONTRACT.modelId,
      pricingVersion: OPENAI_CONTRACT.pricingVersion,
      promptTokensEstimate: 1000,
      maxOutputTokens: 1000,
    });
    expect(lease1.admitted).toBe(true);
    if (lease1.admitted) {
      govTimeout.reconcileFailure(lease1.admissionId, {
        acceptedByProvider: true,
        reason: 'socket_timeout_after_provider_accept',
      });
    }
    const timeoutSnap = govTimeout.exportSnapshot();
    expect(timeoutSnap.uncertainLiabilityMicroUsd).toBe(5250);
    expect(timeoutSnap.spendEvidenceStatus).toBe('UNCERTAIN_FAILED_CALL');
    expect(
      govTimeout.admitCall({
        trialId: 'trial-next',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 500,
      }),
    ).toMatchObject({ admitted: false, code: 'UNCERTAIN_OUTSTANDING_LIABILITY' });

    // 2. Missing usage metadata halts further calls
    const govMissingUsage = new ExperimentCostGovernor(makeConfig());
    const lease2 = govMissingUsage.admitCall({
      trialId: 'trial-no-usage',
      attemptNumber: 1,
      modelId: OPENAI_CONTRACT.modelId,
      pricingVersion: OPENAI_CONTRACT.pricingVersion,
      promptTokensEstimate: 1000,
      maxOutputTokens: 1000,
    });
    expect(lease2.admitted).toBe(true);
    if (lease2.admitted) {
      const rec = govMissingUsage.reconcileSuccess(lease2.admissionId, {
        promptTokens: null,
        completionTokens: null,
      });
      expect(rec.observedCostMicroUsd).toBeNull();
    }
    expect(govMissingUsage.exportSnapshot().spendEvidenceStatus).toBe('MISSING_USAGE_METADATA');
    expect(
      govMissingUsage.admitCall({
        trialId: 'trial-after-missing-usage',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 500,
      }),
    ).toMatchObject({ admitted: false, code: 'UNCERTAIN_OUTSTANDING_LIABILITY' });

    // 3. Partial-run resume preserves completed trial IDs and incomplete reconciliation state
    const govPartial = new ExperimentCostGovernor(makeConfig());
    const lease3 = govPartial.admitCall({
      trialId: 'trial-resume-1',
      attemptNumber: 1,
      modelId: OPENAI_CONTRACT.modelId,
      pricingVersion: OPENAI_CONTRACT.pricingVersion,
      promptTokensEstimate: 1000,
      maxOutputTokens: 1000,
    });
    expect(lease3.admitted).toBe(true);
    if (lease3.admitted) {
      govPartial.reconcileSuccess(lease3.admissionId, { promptTokens: 500, completionTokens: 200 });
    }
    const exported = govPartial.exportSnapshot();
    const resumed = ExperimentCostGovernor.fromSnapshot(makeConfig(), exported);
    expect(resumed.exportSnapshot().actualSpendMicroUsd).toBe(exported.actualSpendMicroUsd);
    expect(
      resumed.admitCall({
        trialId: 'trial-resume-1',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 500,
      }),
    ).toMatchObject({ admitted: false, code: 'DUPLICATE_LOGICAL_TRIAL' });

    // Resumed with an un-reconciled active admission rejects new calls until reconciled
    const unrecLease = resumed.admitCall({
      trialId: 'trial-resume-2',
      attemptNumber: 1,
      modelId: OPENAI_CONTRACT.modelId,
      pricingVersion: OPENAI_CONTRACT.pricingVersion,
      promptTokensEstimate: 500,
      maxOutputTokens: 500,
    });
    expect(unrecLease.admitted).toBe(true);
    const resumedWithInFlight = ExperimentCostGovernor.fromSnapshot(makeConfig(), resumed.exportSnapshot());
    expect(
      resumedWithInFlight.admitCall({
        trialId: 'trial-resume-3',
        attemptNumber: 1,
        modelId: OPENAI_CONTRACT.modelId,
        pricingVersion: OPENAI_CONTRACT.pricingVersion,
        promptTokensEstimate: 500,
        maxOutputTokens: 500,
      }),
    ).toMatchObject({ admitted: false, code: 'CONCURRENT_CALL_NOT_ALLOWED' });
  });
});
