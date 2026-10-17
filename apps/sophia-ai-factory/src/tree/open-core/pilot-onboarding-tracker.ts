/**
 * 6-Step End-to-End Customer Journey & First Paid Pilot Readiness Tracker
 *
 * Enforces the 6 protected flow steps, validates edge SHA parity, checks for
 * zero-defect execution, and produces HMAC-SHA256 readiness attestations.
 *
 * Layer: tree/open-core
 * @module tree/open-core/pilot-onboarding-tracker
 */

import { computeHmacHex } from '@/seed/security/signature-primitives';
import { success, failure, type Result } from '@/seed/types/result';

export type PilotStepKey =
  | 'landing_locale_verified'
  | 'byok_wizard_completed'
  | 'telegram_bot_linked'
  | 'payment_webhook_confirmed'
  | 'd1_tier_activated'
  | 'social_publishing_scheduled';

export type PilotPaymentProvider = 'nowpayments' | 'payos';
export type CanonicalPilotTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

export interface PilotStepRecord {
  readonly stepKey: PilotStepKey;
  readonly status: 'passed' | 'failed' | 'skipped';
  readonly completedAt?: string;
  readonly defectIssueUrl?: string;
  readonly notes?: string;
}

export interface PilotJourneyState {
  readonly customerId: string;
  readonly liveEdgeShortSha: string;
  readonly paymentProvider: string;
  readonly activatedTier: CanonicalPilotTier;
  readonly byokEncryptedInD1: boolean;
  readonly configuredProviders: readonly string[];
  readonly steps: readonly PilotStepRecord[];
}

export interface PilotReadinessReport {
  readonly customerId: string;
  readonly liveEdgeShortSha: string;
  readonly paymentProvider: PilotPaymentProvider;
  readonly activatedTier: CanonicalPilotTier;
  readonly completionPercentage: number;
  readonly passedSteps: readonly PilotStepKey[];
  readonly failedSteps: readonly PilotStepKey[];
  readonly zeroDefectVerified: boolean;
  readonly attestationSignatureHex: string;
}

export const MANDATORY_PILOT_STEPS: readonly PilotStepKey[] = [
  'landing_locale_verified',
  'byok_wizard_completed',
  'telegram_bot_linked',
  'payment_webhook_confirmed',
  'd1_tier_activated',
  'social_publishing_scheduled',
];

const BANNED_PROVIDERS: ReadonlySet<string> = new Set(['polar', 'paypal']);
const ALLOWED_PROVIDERS: ReadonlySet<string> = new Set(['nowpayments', 'payos']);
const VALID_TIERS: ReadonlySet<string> = new Set(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']);
const SHA_REGEX = /^[0-9a-f]{7,40}$/i;
const ATTESTATION_SECRET = 'sophia-pilot-readiness-attestation-v1';

export function validatePilotStateHeader(
  state: PilotJourneyState,
): Result<{ sha: string; provider: PilotPaymentProvider }, { code: string; message: string }> {
  if (!state || typeof state !== 'object') {
    return failure({ code: 'INVALID_STATE', message: 'Pilot journey state must be an object' });
  }
  if (!state.customerId?.trim()) {
    return failure({ code: 'INVALID_CUSTOMER_ID', message: 'Customer ID is required' });
  }
  const sha = state.liveEdgeShortSha ? state.liveEdgeShortSha.trim() : '';
  if (!SHA_REGEX.test(sha)) {
    return failure({ code: 'INVALID_EDGE_SHA', message: 'liveEdgeShortSha must be a valid 7-40 char hex git SHA' });
  }
  const prov = (state.paymentProvider || '').trim().toLowerCase();
  if (BANNED_PROVIDERS.has(prov)) {
    return failure({ code: 'BANNED_PAYMENT_PROVIDER', message: 'Polar and PayPal are banned payment providers in Sophia' });
  }
  if (!ALLOWED_PROVIDERS.has(prov)) {
    return failure({ code: 'INVALID_PAYMENT_PROVIDER', message: 'Payment provider must be either nowpayments or payos' });
  }
  if (!VALID_TIERS.has(state.activatedTier)) {
    return failure({ code: 'INVALID_TIER', message: `Unknown pilot tier: ${String(state.activatedTier)}` });
  }
  return success({ sha: sha.toLowerCase(), provider: prov as PilotPaymentProvider });
}

export function evaluateSinglePilotStep(
  stepKey: PilotStepKey,
  step?: PilotStepRecord,
): Result<'passed' | 'failed', { code: string; message: string }> {
  if (step?.status === 'passed') return success('passed');
  if (step?.status === 'failed') {
    const issueUrl = step.defectIssueUrl?.trim();
    if (!issueUrl || (!issueUrl.startsWith('https://github.com/') && !issueUrl.startsWith('https://gitlab.com/'))) {
      return failure({ code: 'DEFECT_TRACKING_REQUIRED', message: `Failed step '${stepKey}' must specify a valid issue tracker URL` });
    }
  }
  return success('failed');
}

export async function evaluatePilotReadiness(
  state: PilotJourneyState,
): Promise<Result<PilotReadinessReport, { code: string; message: string }>> {
  const headerRes = validatePilotStateHeader(state);
  if (!headerRes.ok) return failure(headerRes.error);
  const { sha, provider } = headerRes.value;

  const stepMap = new Map<PilotStepKey, PilotStepRecord>();
  if (Array.isArray(state.steps)) {
    for (const rec of state.steps) {
      if (rec && typeof rec === 'object' && rec.stepKey) stepMap.set(rec.stepKey, rec);
    }
  }

  const passedSteps: PilotStepKey[] = [];
  const failedSteps: PilotStepKey[] = [];
  for (const stepKey of MANDATORY_PILOT_STEPS) {
    const stepEval = evaluateSinglePilotStep(stepKey, stepMap.get(stepKey));
    if (!stepEval.ok) return failure(stepEval.error);
    if (stepEval.value === 'passed') passedSteps.push(stepKey);
    else failedSteps.push(stepKey);
  }

  const zeroDefectVerified = passedSteps.length === MANDATORY_PILOT_STEPS.length && state.byokEncryptedInD1 === true;
  const completionPercentage = Math.round((passedSteps.length / MANDATORY_PILOT_STEPS.length) * 100);
  const canonicalPayload = JSON.stringify({
    customerId: state.customerId.trim(), liveEdgeShortSha: sha, paymentProvider: provider,
    activatedTier: state.activatedTier, passedSteps, zeroDefectVerified,
  });
  const attestationSignatureHex = await computeHmacHex(canonicalPayload, ATTESTATION_SECRET, 'SHA-256');

  return success({
    customerId: state.customerId.trim(), liveEdgeShortSha: sha, paymentProvider: provider,
    activatedTier: state.activatedTier, completionPercentage, passedSteps, failedSteps, zeroDefectVerified, attestationSignatureHex,
  });
}
