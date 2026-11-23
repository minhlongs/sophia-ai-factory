/**
 * Experiment-specific Budget & Call Cost Governor (B4.1).
 * Enforces fail-closed pre-call admission control, conservative integer micro-USD reservation,
 * retry gating, post-response reconciliation, failed-call usage uncertainty, and resumable state.
 *
 * @module land/eval/first-value-benchmark/cost-governor
 */

import {
  computeConservativeCallCostMicroUsd,
  computeObservedCallCostMicroUsd,
  type PinnedModelPricingContract,
} from './model-contract';
import { addSafeNonNegativeIntegers, assertSafeNonNegativeInteger } from './report-validators';

export type SpendEvidenceStatus =
  | 'NO_SPEND'
  | 'COMPLETE'
  | 'UNCERTAIN_FAILED_CALL'
  | 'MISSING_USAGE_METADATA';

export type AdmissionRejectionCode =
  | 'SPENDING_NOT_AUTHORIZED'
  | 'PROVIDER_SPEND_CAP_NOT_CONFIRMED'
  | 'UNKNOWN_MODEL'
  | 'PRICING_VERSION_MISMATCH'
  | 'MISSING_MODEL_PRICING'
  | 'CONCURRENT_CALL_NOT_ALLOWED'
  | 'UNCERTAIN_OUTSTANDING_LIABILITY'
  | 'DUPLICATE_LOGICAL_TRIAL'
  | 'DUPLICATE_CALL_ATTEMPT'
  | 'RETRY_LIMIT_EXCEEDED'
  | 'CALL_CEILING_EXCEEDED'
  | 'PROMPT_TOKEN_BUDGET_EXCEEDED'
  | 'OUTPUT_TOKEN_CAP_EXCEEDED'
  | 'BUDGET_CEILING_EXCEEDED';

export interface CostGovernorConfig {
  readonly plannedLogicalTrials: number;
  readonly plannedProviderCalls: number;
  readonly maxBillableCalls: number;
  readonly maxRetriesPerTrial: number;
  readonly maxPromptTokensBudget: number;
  readonly maxOutputTokensCap: number;
  readonly authorizedCeilingMicroUsd: number;
  readonly spendingAuthorized: boolean;
  readonly providerSpendingCapConfirmed: boolean;
  readonly pricingContract: PinnedModelPricingContract | null;
}

export interface CallAdmissionRequest {
  readonly trialId: string;
  readonly attemptNumber: number;
  readonly modelId: string;
  readonly pricingVersion: string;
  readonly promptTokensEstimate: number;
  readonly maxOutputTokens: number;
}

export interface AdmittedCallLease {
  readonly admitted: true;
  readonly admissionId: string;
  readonly trialId: string;
  readonly attemptNumber: number;
  readonly reservedMicroUsd: number;
}

export interface RejectedCallDecision {
  readonly admitted: false;
  readonly code: AdmissionRejectionCode;
  readonly reason: string;
}

export type CallAdmissionDecision = AdmittedCallLease | RejectedCallDecision;

export interface PairAdmissionCheckRequest {
  readonly armAPromptTokensEstimate: number;
  readonly armBPromptTokensEstimate: number;
  readonly maxOutputTokens: number;
  readonly modelId: string;
  readonly pricingVersion: string;
}

export type PairAdmissionCheckResult =
  | {
      readonly admissible: true;
      readonly requiredCalls: number;
      readonly worstCasePairMicroUsd: number;
    }
  | {
      readonly admissible: false;
      readonly code: AdmissionRejectionCode;
      readonly reason: string;
      readonly requiredCalls: number;
      readonly worstCasePairMicroUsd: number;
    };

export interface CallUsageReconciliation {
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
  readonly cachedPromptTokens?: number;
  readonly observedChargedMicroUsd?: number | null;
  readonly trialSucceeded?: boolean;
}

export interface CallFailureReconciliation {
  readonly acceptedByProvider: boolean;
  readonly httpStatus?: number;
  readonly reason: string;
}

export interface Stage1CallPolicySummary {
  readonly targetPairs: number;
  readonly targetLogicalTrials: number;
  readonly maxRetriesPerTrial: number;
  readonly maxCallsPerArm: number;
  readonly worstCaseCallsPerPair: number;
  readonly theoreticalMaxCallsForAllPairs: number;
  readonly hardBillableCallCeiling: number;
  readonly guaranteedFullPairsUnderWorstCase: number;
  readonly remainingUnpairedSlotHeadroom: number;
  readonly policyNote: string;
}

export function computeStage1CallPolicySummary(args: {
  readonly targetPairs: number;
  readonly maxRetriesPerTrial: number;
  readonly maxBillableCalls: number;
}): Stage1CallPolicySummary {
  assertSafeNonNegativeInteger(args.targetPairs, 'targetPairs');
  assertSafeNonNegativeInteger(args.maxRetriesPerTrial, 'maxRetriesPerTrial');
  assertSafeNonNegativeInteger(args.maxBillableCalls, 'maxBillableCalls');

  const maxCallsPerArm = 1 + args.maxRetriesPerTrial;
  const worstCaseCallsPerPair = maxCallsPerArm * 2;
  const targetLogicalTrials = args.targetPairs * 2;
  const theoreticalMaxCallsForAllPairs = args.targetPairs * worstCaseCallsPerPair;
  const guaranteedFullPairsUnderWorstCase =
    worstCaseCallsPerPair > 0 ? Math.min(args.targetPairs, Math.floor(args.maxBillableCalls / worstCaseCallsPerPair)) : 0;
  const remainingUnpairedSlotHeadroom =
    worstCaseCallsPerPair > 0 && guaranteedFullPairsUnderWorstCase < args.targetPairs
      ? args.maxBillableCalls % worstCaseCallsPerPair
      : 0;

  return {
    targetPairs: args.targetPairs,
    targetLogicalTrials,
    maxRetriesPerTrial: args.maxRetriesPerTrial,
    maxCallsPerArm,
    worstCaseCallsPerPair,
    theoreticalMaxCallsForAllPairs,
    hardBillableCallCeiling: args.maxBillableCalls,
    guaranteedFullPairsUnderWorstCase,
    remainingUnpairedSlotHeadroom,
    policyNote: `Hard ceiling of ${args.maxBillableCalls} calls guarantees ${guaranteedFullPairsUnderWorstCase}/${args.targetPairs} full pairs under worst-case ${worstCaseCallsPerPair} calls/pair (theoretical max for all pairs: ${theoreticalMaxCallsForAllPairs}); fewer actual retries permit up to ${args.targetPairs} completed pairs.`,
  };
}

export interface CostGovernorSnapshot {
  readonly plannedLogicalTrials: number;
  readonly plannedProviderCalls: number;
  readonly maxBillableCalls: number;
  readonly authorizedCeilingMicroUsd: number;
  readonly reservedMicroUsd: number;
  readonly actualSpendMicroUsd: number;
  readonly uncertainLiabilityMicroUsd: number;
  readonly remainingBudgetMicroUsd: number;
  readonly admittedCalls: number;
  readonly completedCalls: number;
  readonly failedCalls: number;
  readonly retryCount: number;
  readonly pricingVersion: string;
  readonly spendEvidenceStatus: SpendEvidenceStatus;
  readonly completedTrialIds: readonly string[];
  readonly seenAttemptKeys: readonly string[];
  readonly unresolvedLiabilityByTrialMicroUsd?: Readonly<Record<string, number>>;
  readonly activeAdmission: { readonly admissionId: string; readonly trialId: string; readonly reservedMicroUsd: number } | null;
}

export interface DeferredUsageReconciliationInput {
  readonly trialId: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly cachedPromptTokens?: number;
  readonly observedChargedMicroUsd?: number | null;
  readonly trialSucceeded: boolean;
  readonly authorizedBy: string;
}

function reject(code: AdmissionRejectionCode, reason: string): RejectedCallDecision {
  return { admitted: false, code, reason };
}

export class ExperimentCostGovernor {
  private readonly config: CostGovernorConfig;
  private reservedMicroUsd = 0;
  private actualSpendMicroUsd = 0;
  private uncertainLiabilityMicroUsd = 0;
  private admittedCalls = 0;
  private completedCalls = 0;
  private failedCalls = 0;
  private retryCount = 0;
  private spendEvidenceStatus: SpendEvidenceStatus = 'NO_SPEND';
  private activeAdmission: { admissionId: string; trialId: string; reservedMicroUsd: number } | null = null;
  private readonly completedTrialIds = new Set<string>();
  private readonly seenAttemptKeys = new Set<string>();
  private readonly unresolvedLiabilityByTrial = new Map<string, number>();

  constructor(config: CostGovernorConfig) {
    assertSafeNonNegativeInteger(config.plannedLogicalTrials, 'plannedLogicalTrials');
    assertSafeNonNegativeInteger(config.plannedProviderCalls, 'plannedProviderCalls');
    assertSafeNonNegativeInteger(config.maxBillableCalls, 'maxBillableCalls');
    assertSafeNonNegativeInteger(config.maxRetriesPerTrial, 'maxRetriesPerTrial');
    assertSafeNonNegativeInteger(config.maxPromptTokensBudget, 'maxPromptTokensBudget');
    assertSafeNonNegativeInteger(config.maxOutputTokensCap, 'maxOutputTokensCap');
    assertSafeNonNegativeInteger(config.authorizedCeilingMicroUsd, 'authorizedCeilingMicroUsd');
    this.config = config;
  }

  static fromSnapshot(config: CostGovernorConfig, snapshot: CostGovernorSnapshot): ExperimentCostGovernor {
    if (config.pricingContract && snapshot.pricingVersion !== config.pricingContract.pricingVersion) {
      throw new Error(
        `Snapshot pricingVersion "${snapshot.pricingVersion}" does not match "${config.pricingContract.pricingVersion}"`,
      );
    }
    const allowedStatuses = new Set<SpendEvidenceStatus>([
      'NO_SPEND',
      'COMPLETE',
      'UNCERTAIN_FAILED_CALL',
      'MISSING_USAGE_METADATA',
    ]);
    if (!allowedStatuses.has(snapshot.spendEvidenceStatus)) {
      throw new Error(`Invalid snapshot spendEvidenceStatus: ${String(snapshot.spendEvidenceStatus)}`);
    }
    const gov = new ExperimentCostGovernor(config);
    gov.reservedMicroUsd = assertSafeNonNegativeInteger(snapshot.reservedMicroUsd, 'reservedMicroUsd');
    gov.actualSpendMicroUsd = assertSafeNonNegativeInteger(snapshot.actualSpendMicroUsd, 'actualSpendMicroUsd');
    gov.uncertainLiabilityMicroUsd = assertSafeNonNegativeInteger(
      snapshot.uncertainLiabilityMicroUsd,
      'uncertainLiabilityMicroUsd',
    );
    gov.admittedCalls = assertSafeNonNegativeInteger(snapshot.admittedCalls, 'admittedCalls');
    gov.completedCalls = assertSafeNonNegativeInteger(snapshot.completedCalls, 'completedCalls');
    gov.failedCalls = assertSafeNonNegativeInteger(snapshot.failedCalls, 'failedCalls');
    gov.retryCount = assertSafeNonNegativeInteger(snapshot.retryCount, 'retryCount');

    if (snapshot.activeAdmission) {
      const activeReserved = assertSafeNonNegativeInteger(
        snapshot.activeAdmission.reservedMicroUsd,
        'activeAdmission.reservedMicroUsd',
      );
      if (gov.reservedMicroUsd !== activeReserved) {
        throw new Error(
          `Snapshot reservedMicroUsd (${gov.reservedMicroUsd}) !== activeAdmission.reservedMicroUsd (${activeReserved})`,
        );
      }
      gov.activeAdmission = {
        admissionId: snapshot.activeAdmission.admissionId,
        trialId: snapshot.activeAdmission.trialId,
        reservedMicroUsd: activeReserved,
      };
    } else {
      if (gov.reservedMicroUsd !== 0) {
        throw new Error(`Snapshot reservedMicroUsd must be 0 when activeAdmission is null (got ${gov.reservedMicroUsd})`);
      }
      gov.activeAdmission = null;
    }

    const expectedAdmitted = gov.completedCalls + gov.failedCalls + (gov.activeAdmission ? 1 : 0);
    if (gov.admittedCalls !== expectedAdmitted) {
      throw new Error(
        `Snapshot admittedCalls (${gov.admittedCalls}) !== completed+failed+active (${expectedAdmitted})`,
      );
    }
    if (gov.admittedCalls < snapshot.seenAttemptKeys.length) {
      throw new Error(
        `Snapshot admittedCalls (${gov.admittedCalls}) < seenAttemptKeys.length (${snapshot.seenAttemptKeys.length})`,
      );
    }

    gov.spendEvidenceStatus = snapshot.spendEvidenceStatus;
    for (const id of snapshot.completedTrialIds) gov.completedTrialIds.add(id);
    for (const key of snapshot.seenAttemptKeys) gov.seenAttemptKeys.add(key);
    let totalTrialUnresolved = 0;
    if (snapshot.unresolvedLiabilityByTrialMicroUsd) {
      for (const [trialId, amount] of Object.entries(snapshot.unresolvedLiabilityByTrialMicroUsd)) {
        const validated = assertSafeNonNegativeInteger(amount, `unresolvedLiabilityByTrialMicroUsd[${trialId}]`);
        if (validated > 0) {
          if (gov.completedTrialIds.has(trialId)) {
            throw new Error(
              `Snapshot trial "${trialId}" cannot be both completed and have unresolved liability (${validated})`,
            );
          }
          gov.unresolvedLiabilityByTrial.set(trialId, validated);
          totalTrialUnresolved = addSafeNonNegativeIntegers(
            totalTrialUnresolved,
            validated,
            'totalTrialUnresolved',
          );
        }
      }
    }
    if (gov.uncertainLiabilityMicroUsd > 0 && totalTrialUnresolved !== gov.uncertainLiabilityMicroUsd) {
      throw new Error(
        `Snapshot unresolvedLiabilityByTrialMicroUsd sum (${totalTrialUnresolved}) !== uncertainLiabilityMicroUsd (${gov.uncertainLiabilityMicroUsd})`,
      );
    }
    if (gov.uncertainLiabilityMicroUsd === 0 && totalTrialUnresolved > 0) {
      throw new Error(
        `Snapshot unresolvedLiabilityByTrialMicroUsd sum (${totalTrialUnresolved}) exceeds uncertainLiabilityMicroUsd (0)`,
      );
    }
    return gov;
  }

  private validatePreconditions(req: CallAdmissionRequest): RejectedCallDecision | null {
    if (!this.config.spendingAuthorized) {
      return reject('SPENDING_NOT_AUTHORIZED', 'Experiment spend authorization is false (fail-closed)');
    }
    if (!this.config.pricingContract) {
      return reject('MISSING_MODEL_PRICING', 'Pinned model pricing contract is missing');
    }
    if (this.config.pricingContract.supportsProviderSpendCap && !this.config.providerSpendingCapConfirmed) {
      return reject('PROVIDER_SPEND_CAP_NOT_CONFIRMED', 'Provider-side spending cap must be confirmed before paid execution');
    }
    if (req.modelId !== this.config.pricingContract.modelId) {
      return reject('UNKNOWN_MODEL', `Requested model "${req.modelId}" !== approved "${this.config.pricingContract.modelId}"`);
    }
    if (req.pricingVersion !== this.config.pricingContract.pricingVersion) {
      return reject(
        'PRICING_VERSION_MISMATCH',
        `Pricing version "${req.pricingVersion}" !== pinned "${this.config.pricingContract.pricingVersion}"`,
      );
    }
    if (this.activeAdmission) {
      return reject('CONCURRENT_CALL_NOT_ALLOWED', `Call "${this.activeAdmission.admissionId}" is already in flight`);
    }
    if (this.uncertainLiabilityMicroUsd > 0 || this.spendEvidenceStatus === 'MISSING_USAGE_METADATA') {
      return reject('UNCERTAIN_OUTSTANDING_LIABILITY', 'Uncertain spend liability blocks further paid calls');
    }
    return null;
  }

  private validateCallBounds(req: CallAdmissionRequest): RejectedCallDecision | null {
    if (this.completedTrialIds.has(req.trialId)) {
      return reject('DUPLICATE_LOGICAL_TRIAL', `Logical trial "${req.trialId}" already completed`);
    }
    if (
      !Number.isSafeInteger(req.attemptNumber) ||
      req.attemptNumber < 1 ||
      req.attemptNumber > this.config.maxRetriesPerTrial + 1
    ) {
      return reject('RETRY_LIMIT_EXCEEDED', `Attempt ${req.attemptNumber} exceeds maxRetriesPerTrial=${this.config.maxRetriesPerTrial}`);
    }
    const attemptKey = `${req.trialId}#${req.attemptNumber}`;
    if (this.seenAttemptKeys.has(attemptKey)) {
      return reject('DUPLICATE_CALL_ATTEMPT', `Attempt "${attemptKey}" was already admitted`);
    }
    if (this.admittedCalls + 1 > this.config.maxBillableCalls) {
      return reject('CALL_CEILING_EXCEEDED', `Admitting call exceeds maxBillableCalls=${this.config.maxBillableCalls}`);
    }
    if (
      !Number.isSafeInteger(req.promptTokensEstimate) ||
      req.promptTokensEstimate < 0 ||
      req.promptTokensEstimate > this.config.maxPromptTokensBudget
    ) {
      return reject('PROMPT_TOKEN_BUDGET_EXCEEDED', `Prompt estimate ${req.promptTokensEstimate} outside 0..${this.config.maxPromptTokensBudget}`);
    }
    if (
      !Number.isSafeInteger(req.maxOutputTokens) ||
      req.maxOutputTokens < 0 ||
      req.maxOutputTokens > this.config.maxOutputTokensCap
    ) {
      return reject('OUTPUT_TOKEN_CAP_EXCEEDED', `maxOutputTokens ${req.maxOutputTokens} outside 0..${this.config.maxOutputTokensCap}`);
    }
    return null;
  }

  canAdmitBriefPair(req: PairAdmissionCheckRequest): PairAdmissionCheckResult {
    const callsPerArm = 1 + this.config.maxRetriesPerTrial;
    const requiredCalls = callsPerArm * 2;
    const preErr = this.validatePreconditions({
      trialId: '__pair_check__',
      attemptNumber: 1,
      modelId: req.modelId,
      pricingVersion: req.pricingVersion,
      promptTokensEstimate: req.armAPromptTokensEstimate,
      maxOutputTokens: req.maxOutputTokens,
    });
    if (preErr) {
      return { admissible: false, code: preErr.code, reason: preErr.reason, requiredCalls, worstCasePairMicroUsd: 0 };
    }
    const contract = this.config.pricingContract;
    if (!contract) {
      return {
        admissible: false,
        code: 'MISSING_MODEL_PRICING',
        reason: 'Pinned model pricing contract is missing',
        requiredCalls,
        worstCasePairMicroUsd: 0,
      };
    }
    for (const estimate of [req.armAPromptTokensEstimate, req.armBPromptTokensEstimate]) {
      if (!Number.isSafeInteger(estimate) || estimate < 0 || estimate > this.config.maxPromptTokensBudget) {
        return {
          admissible: false,
          code: 'PROMPT_TOKEN_BUDGET_EXCEEDED',
          reason: `Prompt estimate ${estimate} outside 0..${this.config.maxPromptTokensBudget}`,
          requiredCalls,
          worstCasePairMicroUsd: 0,
        };
      }
    }
    if (
      !Number.isSafeInteger(req.maxOutputTokens) ||
      req.maxOutputTokens < 0 ||
      req.maxOutputTokens > this.config.maxOutputTokensCap
    ) {
      return {
        admissible: false,
        code: 'OUTPUT_TOKEN_CAP_EXCEEDED',
        reason: `maxOutputTokens ${req.maxOutputTokens} outside 0..${this.config.maxOutputTokensCap}`,
        requiredCalls,
        worstCasePairMicroUsd: 0,
      };
    }
    if (this.admittedCalls + requiredCalls > this.config.maxBillableCalls) {
      return {
        admissible: false,
        code: 'CALL_CEILING_EXCEEDED',
        reason: `Starting brief pair requires up to ${requiredCalls} calls, exceeding maxBillableCalls=${this.config.maxBillableCalls} (admitted=${this.admittedCalls})`,
        requiredCalls,
        worstCasePairMicroUsd: 0,
      };
    }
    const armACallCost = computeConservativeCallCostMicroUsd(contract, req.armAPromptTokensEstimate, req.maxOutputTokens);
    const armBCallCost = computeConservativeCallCostMicroUsd(contract, req.armBPromptTokensEstimate, req.maxOutputTokens);
    const pairSingleAttemptCost = addSafeNonNegativeIntegers(armACallCost, armBCallCost, 'pairSingleAttemptCost');
    let worstCasePairMicroUsd = 0;
    for (let i = 0; i < callsPerArm; i += 1) {
      worstCasePairMicroUsd = addSafeNonNegativeIntegers(
        worstCasePairMicroUsd,
        pairSingleAttemptCost,
        'worstCasePairMicroUsd',
      );
    }
    const committed = addSafeNonNegativeIntegers(
      addSafeNonNegativeIntegers(this.actualSpendMicroUsd, this.reservedMicroUsd, 'committedSpend'),
      this.uncertainLiabilityMicroUsd,
      'committedWithUncertain',
    );
    const projected = addSafeNonNegativeIntegers(committed, worstCasePairMicroUsd, 'projectedPairSpend');
    if (projected > this.config.authorizedCeilingMicroUsd) {
      return {
        admissible: false,
        code: 'BUDGET_CEILING_EXCEEDED',
        reason: `Worst-case brief pair cost (${worstCasePairMicroUsd} microUSD) projects ${projected} > ceiling ${this.config.authorizedCeilingMicroUsd} microUSD`,
        requiredCalls,
        worstCasePairMicroUsd,
      };
    }
    return { admissible: true, requiredCalls, worstCasePairMicroUsd };
  }

  admitCall(req: CallAdmissionRequest): CallAdmissionDecision {
    const preErr = this.validatePreconditions(req) ?? this.validateCallBounds(req);
    if (preErr) return preErr;

    const contract = this.config.pricingContract;
    if (!contract) return reject('MISSING_MODEL_PRICING', 'Pinned model pricing contract is missing');

    const reservation = computeConservativeCallCostMicroUsd(contract, req.promptTokensEstimate, req.maxOutputTokens);
    const committed = addSafeNonNegativeIntegers(
      addSafeNonNegativeIntegers(this.actualSpendMicroUsd, this.reservedMicroUsd, 'committedSpend'),
      this.uncertainLiabilityMicroUsd,
      'committedWithUncertain',
    );
    const projected = addSafeNonNegativeIntegers(committed, reservation, 'projectedSpend');
    if (projected > this.config.authorizedCeilingMicroUsd) {
      return reject(
        'BUDGET_CEILING_EXCEEDED',
        `Projected ${projected} microUSD exceeds ceiling ${this.config.authorizedCeilingMicroUsd} microUSD`,
      );
    }

    const admissionId = `${req.trialId}:attempt-${req.attemptNumber}`;
    this.reservedMicroUsd = addSafeNonNegativeIntegers(this.reservedMicroUsd, reservation, 'reservedMicroUsd');
    this.admittedCalls += 1;
    if (req.attemptNumber > 1) this.retryCount += 1;
    this.seenAttemptKeys.add(`${req.trialId}#${req.attemptNumber}`);
    this.activeAdmission = { admissionId, trialId: req.trialId, reservedMicroUsd: reservation };

    return {
      admitted: true,
      admissionId,
      trialId: req.trialId,
      attemptNumber: req.attemptNumber,
      reservedMicroUsd: reservation,
    };
  }

  reconcileSuccess(admissionId: string, usage: CallUsageReconciliation): {
    readonly observedCostMicroUsd: number | null;
    readonly reservationDeltaMicroUsd: number | null;
  } {
    const active = this.assertActiveAdmission(admissionId);
    const contract = this.config.pricingContract;

    if (!contract || usage.promptTokens === null || usage.completionTokens === null) {
      const nextUncertain = addSafeNonNegativeIntegers(
        this.uncertainLiabilityMicroUsd,
        active.reservedMicroUsd,
        'uncertainLiabilityMicroUsd',
      );
      const prevTrialUnresolved = this.unresolvedLiabilityByTrial.get(active.trialId) ?? 0;
      this.unresolvedLiabilityByTrial.set(
        active.trialId,
        addSafeNonNegativeIntegers(prevTrialUnresolved, active.reservedMicroUsd, 'unresolvedLiabilityByTrial'),
      );
      this.reservedMicroUsd -= active.reservedMicroUsd;
      this.activeAdmission = null;
      this.completedCalls += 1;
      this.uncertainLiabilityMicroUsd = nextUncertain;
      this.spendEvidenceStatus = 'MISSING_USAGE_METADATA';
      return { observedCostMicroUsd: null, reservationDeltaMicroUsd: null };
    }

    const computedCost = computeObservedCallCostMicroUsd(contract, {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cachedPromptTokens: usage.cachedPromptTokens,
    });
    const observedCost =
      usage.observedChargedMicroUsd !== undefined && usage.observedChargedMicroUsd !== null
        ? assertSafeNonNegativeInteger(usage.observedChargedMicroUsd, 'observedChargedMicroUsd')
        : computedCost;
    const nextActualSpend = addSafeNonNegativeIntegers(
      this.actualSpendMicroUsd,
      observedCost,
      'actualSpendMicroUsd',
    );

    this.reservedMicroUsd -= active.reservedMicroUsd;
    this.activeAdmission = null;
    this.completedCalls += 1;
    if (usage.trialSucceeded !== false && !this.unresolvedLiabilityByTrial.has(active.trialId)) {
      this.completedTrialIds.add(active.trialId);
    }
    this.actualSpendMicroUsd = nextActualSpend;
    if (this.spendEvidenceStatus === 'NO_SPEND') {
      this.spendEvidenceStatus = 'COMPLETE';
    }
    return {
      observedCostMicroUsd: observedCost,
      reservationDeltaMicroUsd: observedCost - active.reservedMicroUsd,
    };
  }

  reconcileFailure(admissionId: string, failure: CallFailureReconciliation): void {
    const active = this.assertActiveAdmission(admissionId);
    this.reservedMicroUsd -= active.reservedMicroUsd;
    this.activeAdmission = null;
    this.failedCalls += 1;

    if (failure.acceptedByProvider) {
      this.uncertainLiabilityMicroUsd = addSafeNonNegativeIntegers(
        this.uncertainLiabilityMicroUsd,
        active.reservedMicroUsd,
        'uncertainLiabilityMicroUsd',
      );
      const prevTrialUnresolved = this.unresolvedLiabilityByTrial.get(active.trialId) ?? 0;
      this.unresolvedLiabilityByTrial.set(
        active.trialId,
        addSafeNonNegativeIntegers(prevTrialUnresolved, active.reservedMicroUsd, 'unresolvedLiabilityByTrial'),
      );
      this.spendEvidenceStatus = 'UNCERTAIN_FAILED_CALL';
    }
  }

  /**
   * Explicitly reconciles deferred provider usage for a trial with unresolved liability.
   * Transitions held uncertain liability to measured actual spend and marks the trial
   * completed only when trialSucceeded is true and authorizedBy is non-empty.
   */
  reconcileDeferredUsage(input: DeferredUsageReconciliationInput): {
    readonly observedCostMicroUsd: number;
    readonly releasedUncertainLiabilityMicroUsd: number;
  } {
    if (this.activeAdmission !== null) {
      throw new Error(
        `DEFERRED_RECONCILIATION_ACTIVE_ADMISSION: cannot reconcile deferred usage while admission "${this.activeAdmission.admissionId}" is active`,
      );
    }
    if (!input.authorizedBy.trim()) {
      throw new Error('DEFERRED_RECONCILIATION_UNAUTHORIZED: authorizedBy is required');
    }
    const contract = this.config.pricingContract;
    if (!contract) {
      throw new Error('DEFERRED_RECONCILIATION_FAILED: pricingContract is missing');
    }
    if (this.completedTrialIds.has(input.trialId)) {
      throw new Error(
        `DEFERRED_RECONCILIATION_DUPLICATE: trial "${input.trialId}" is already completed`,
      );
    }
    const heldLiability = this.unresolvedLiabilityByTrial.get(input.trialId);
    if (heldLiability === undefined || heldLiability <= 0) {
      throw new Error(
        `DEFERRED_RECONCILIATION_NOT_PENDING: trial "${input.trialId}" has no unresolved liability`,
      );
    }
    if (heldLiability > this.uncertainLiabilityMicroUsd) {
      throw new Error(
        `DEFERRED_RECONCILIATION_INVARIANT: heldLiability (${heldLiability}) exceeds uncertainLiabilityMicroUsd (${this.uncertainLiabilityMicroUsd})`,
      );
    }

    const computedCost = computeObservedCallCostMicroUsd(contract, {
      promptTokens: assertSafeNonNegativeInteger(input.promptTokens, 'promptTokens'),
      completionTokens: assertSafeNonNegativeInteger(input.completionTokens, 'completionTokens'),
      cachedPromptTokens: input.cachedPromptTokens,
    });
    const observedCost =
      input.observedChargedMicroUsd !== undefined && input.observedChargedMicroUsd !== null
        ? assertSafeNonNegativeInteger(input.observedChargedMicroUsd, 'observedChargedMicroUsd')
        : computedCost;

    this.uncertainLiabilityMicroUsd -= heldLiability;
    this.unresolvedLiabilityByTrial.delete(input.trialId);
    this.actualSpendMicroUsd = addSafeNonNegativeIntegers(
      this.actualSpendMicroUsd,
      observedCost,
      'actualSpendMicroUsd',
    );
    if (input.trialSucceeded) {
      this.completedTrialIds.add(input.trialId);
    }
    if (this.uncertainLiabilityMicroUsd === 0 && this.unresolvedLiabilityByTrial.size === 0) {
      this.spendEvidenceStatus = 'COMPLETE';
    }
    return {
      observedCostMicroUsd: observedCost,
      releasedUncertainLiabilityMicroUsd: heldLiability,
    };
  }

  /**
   * Rolls back an active reservation ONLY when no provider request was ever sent
   * (e.g., local request-mapping rejection before network dispatch).
   */
  rollbackUnissuedAdmission(admissionId: string, _reason: string): void {
    const active = this.assertActiveAdmission(admissionId);
    const attemptSuffix = admissionId.slice(admissionId.lastIndexOf(':attempt-') + ':attempt-'.length);
    const attemptNumber = Number(attemptSuffix);
    this.reservedMicroUsd -= active.reservedMicroUsd;
    this.activeAdmission = null;
    this.admittedCalls = Math.max(0, this.admittedCalls - 1);
    if (Number.isSafeInteger(attemptNumber) && attemptNumber > 1) {
      this.retryCount = Math.max(0, this.retryCount - 1);
    }
    if (Number.isSafeInteger(attemptNumber) && attemptNumber >= 1) {
      this.seenAttemptKeys.delete(`${active.trialId}#${attemptNumber}`);
    }
  }

  private assertActiveAdmission(admissionId: string): { admissionId: string; trialId: string; reservedMicroUsd: number } {
    if (!this.activeAdmission || this.activeAdmission.admissionId !== admissionId) {
      throw new Error(`No matching active admission for "${admissionId}"`);
    }
    return this.activeAdmission;
  }

  exportSnapshot(): CostGovernorSnapshot {
    const committed = this.actualSpendMicroUsd + this.reservedMicroUsd + this.uncertainLiabilityMicroUsd;
    const remaining = Math.max(0, this.config.authorizedCeilingMicroUsd - committed);
    const unresolvedLiabilityByTrialMicroUsd: Record<string, number> = {};
    for (const [trialId, amount] of this.unresolvedLiabilityByTrial.entries()) {
      unresolvedLiabilityByTrialMicroUsd[trialId] = amount;
    }
    return {
      plannedLogicalTrials: this.config.plannedLogicalTrials,
      plannedProviderCalls: this.config.plannedProviderCalls,
      maxBillableCalls: this.config.maxBillableCalls,
      authorizedCeilingMicroUsd: this.config.authorizedCeilingMicroUsd,
      reservedMicroUsd: this.reservedMicroUsd,
      actualSpendMicroUsd: this.actualSpendMicroUsd,
      uncertainLiabilityMicroUsd: this.uncertainLiabilityMicroUsd,
      remainingBudgetMicroUsd: remaining,
      admittedCalls: this.admittedCalls,
      completedCalls: this.completedCalls,
      failedCalls: this.failedCalls,
      retryCount: this.retryCount,
      pricingVersion: this.config.pricingContract?.pricingVersion ?? 'MISSING',
      spendEvidenceStatus: this.spendEvidenceStatus,
      completedTrialIds: [...this.completedTrialIds],
      seenAttemptKeys: [...this.seenAttemptKeys],
      unresolvedLiabilityByTrialMicroUsd,
      activeAdmission: this.activeAdmission ? { ...this.activeAdmission } : null,
    };
  }
}
