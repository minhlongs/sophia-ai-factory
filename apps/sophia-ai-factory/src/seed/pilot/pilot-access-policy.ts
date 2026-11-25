/**
 * Invite-only access, kill-switch, financing mode, and cost-containment policy
 * for the First Real Customer Pilot.
 *
 * Pure foundational helpers (seed layer — zero external or DB dependencies).
 * Fail-closed when `PILOT_INVITE_ONLY=true` and allowlist or cost controls are absent.
 *
 * @module seed/pilot/pilot-access-policy
 */

import { PILOT_TECHNICAL_ORIGIN } from '@/seed/domain';

export const PILOT_POLICY_VERSION = '2026-11-pilot-v2';

export const PILOT_EVENT_NAMES = [
  'INVITE_ACCEPTED',
  'FIRST_LOGIN',
  'BYOK_KEY_SAVED',
  'BYOK_KEY_CLEARED',
  'HEYGEN_BYOK_SAVED',
  'HEYGEN_BYOK_CLEARED',
  'BRIEF_SUBMITTED',
  'GENERATION_REQUESTED',
  'GENERATION_SUCCEEDED',
  'GENERATION_FAILED',
  'SCRIPT_REVIEWED',
  'SCRIPT_EDITED',
  'SCRIPT_EXPORTED',
  'AFFILIATE_SHORTLINK_CREATED',
  'MP4_EXPORT_REQUESTED',
  'MP4_EXPORTED',
  'MP4_EXPORT_FAILED',
  'MANUAL_PUBLISH_RECORDED',
  'CUSTOMER_FEEDBACK_SUBMITTED',
  'SUPPORT_REQUEST_SUBMITTED',
  'DATA_DELETION_REQUESTED',
] as const;

export type PilotEventName = (typeof PILOT_EVENT_NAMES)[number];

export type PilotFundingMode = 'customer_byok' | 'founder_sponsored' | 'none';

export type PilotFinancingMode = 'FOUNDER_SPONSORED' | 'CUSTOMER_BYOK' | 'DISABLED';

export type PilotSupportRequestType = 'support' | 'data_deletion';
export type PilotSupportRequestStatus = 'open' | 'acknowledged' | 'completed';

export interface PilotSupportRequestSummary {
  readonly id: string;
  readonly requestType: PilotSupportRequestType;
  readonly subject: string;
  readonly status: PilotSupportRequestStatus;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly resolvedAtIso: string | null;
}

export interface PilotAffiliateLinkSummary {
  readonly id: string;
  readonly artifactId: string | null;
  readonly shortCode: string;
  readonly shortUrl: string;
  readonly destinationUrl: string;
  readonly ctaText: string;
  readonly networkHint: string;
  readonly subId: string;
  readonly disclosureTag: string;
  readonly verifiedClicks: number;
  readonly createdAtIso: string;
}

export interface PilotMp4ExportSummary {
  readonly id: string;
  readonly artifactId: string;
  readonly renderMode: 'browser_h264_mp4' | 'heygen_byok_mp4';
  readonly heygenJobId: string | null;
  readonly status: 'processing' | 'completed' | 'failed';
  readonly sha256Hex: string | null;
  readonly byteSize: number | null;
  readonly durationSec: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly codec: string;
  readonly containerBrand: string;
  readonly ctaText: string;
  readonly shortCode: string;
  readonly referralUrl: string;
  readonly providerVideoUrl: string | null;
  readonly errorCode: string | null;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
}

export interface PilotManualPublishSummary {
  readonly id: string;
  readonly artifactId: string | null;
  readonly mp4ExportId: string | null;
  readonly linkId: string | null;
  readonly platform: 'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'facebook_reels' | 'other';
  readonly publishedPostUrl: string;
  readonly reportedViews: number | null;
  readonly reportedConversions: number | null;
  readonly reportedCommissionAmount: number | null;
  readonly reportedCommissionCurrency: string | null;
  readonly evidenceNote: string | null;
  readonly provenance: 'CUSTOMER_SELF_REPORTED';
  readonly createdAtIso: string;
}

export interface PilotQuotaSnapshot {
  readonly usedGenerations: number;
  readonly maxGenerations: number;
  readonly remainingGenerations: number;
  readonly lastGenerationAtIso: string | null;
  readonly estimatedSpendUsd?: number;
  readonly maxEstimatedSpendUsd?: number;
}

export interface PilotStatusSnapshot {
  readonly inviteOnly: boolean;
  readonly liveInferenceEnabled: boolean;
  readonly policyVersion: string;
  readonly consentAccepted: boolean;
  readonly consentAcceptedAtIso: string | null;
  readonly financingMode?: PilotFinancingMode;
  readonly fundingMode: PilotFundingMode;
  readonly modelId?: string;
  readonly byokKeyConfigured?: boolean;
  readonly heygenByokConfigured?: boolean;
  readonly supportRequests?: readonly PilotSupportRequestSummary[];
  readonly affiliateLinks?: readonly PilotAffiliateLinkSummary[];
  readonly mp4Exports?: readonly PilotMp4ExportSummary[];
  readonly manualPublishes?: readonly PilotManualPublishSummary[];
  readonly quota: PilotQuotaSnapshot;
}

export interface PilotCostControlConfig {
  readonly maxGenerations: number;
  readonly maxEstimatedSpendMicroUsd: number;
  readonly maxEstimatedSpendUsd: number;
  readonly estimatedCostPerAttemptMicroUsd: number;
  readonly modelId: string;
  readonly maxOutputTokens: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly cooldownMs: number;
  readonly inFlightLockMs: number;
}

export type PilotCostControlValidation =
  | { readonly ok: true; readonly config: PilotCostControlConfig }
  | { readonly ok: false; readonly missingOrInvalid: readonly string[] };

export interface PilotEnvSource {
  readonly [key: string]: string | undefined;
  readonly PILOT_INVITE_ONLY?: string;
  readonly PILOT_ALLOWED_EMAILS?: string;
  readonly PILOT_LIVE_INFERENCE_ENABLED?: string;
  readonly PILOT_FINANCING_MODE?: string;
  readonly PILOT_MAX_GENERATIONS?: string;
  readonly PILOT_MAX_ESTIMATED_SPEND_USD?: string;
  readonly PILOT_ESTIMATED_COST_PER_ATTEMPT_USD?: string;
  readonly PILOT_MODEL_ID?: string;
  readonly PILOT_MAX_OUTPUT_TOKENS?: string;
  readonly PILOT_MAX_RETRIES?: string;
  readonly PILOT_TIMEOUT_MS?: string;
  readonly PILOT_RATE_LIMIT_COOLDOWN_MS?: string;
  readonly PILOT_OPENROUTER_API_KEY?: string;
  readonly PAYMENTS_ENABLED?: string;
  readonly B2_PUBLISH_ENABLED?: string;
  readonly APP_URL?: string;
  readonly BETTER_AUTH_URL?: string;
}

export const PILOT_DEFAULT_MODEL = 'openai/gpt-4o-mini';
export const PILOT_ALLOWED_MODELS: ReadonlySet<string> = new Set([PILOT_DEFAULT_MODEL]);

const DEFAULT_MAX_GENERATIONS = 20;
const MIN_MAX_GENERATIONS = 1;
const MAX_MAX_GENERATIONS = 100;
const DEFAULT_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 300_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 2048;
const MIN_OUTPUT_TOKENS = 256;
const MAX_OUTPUT_TOKENS = 2048;
const DEFAULT_MAX_RETRIES = 1;
const MAX_RETRIES_CEILING = 1;
const DEFAULT_TIMEOUT_MS = 45_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 45_000;
const MAX_SPEND_USD_CEILING = 50;
// Conservative worst-case per-attempt estimate ($0.02) covering prompt + 2048 output tokens + 1 retry on gpt-4o-mini.
const DEFAULT_ESTIMATED_COST_PER_ATTEMPT_MICROUSD = 20_000;
const DEFAULT_IN_FLIGHT_LOCK_MS = 60_000;
const MICROUSD_PER_USD = 1_000_000;

export function normalizePilotEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isPilotInviteOnlyEnabled(env: PilotEnvSource = process.env): boolean {
  return (env.PILOT_INVITE_ONLY ?? '').trim().toLowerCase() === 'true';
}

export function parsePilotAllowedEmails(env: PilotEnvSource = process.env): ReadonlySet<string> {
  const raw = env.PILOT_ALLOWED_EMAILS ?? '';
  const emails = raw
    .split(/[,;\n]+/)
    .map((entry) => normalizePilotEmail(entry))
    .filter((entry) => entry.length > 3 && entry.includes('@'));
  return new Set(emails);
}

export function isEmailAllowedForPilot(
  email: string | null | undefined,
  env: PilotEnvSource = process.env,
): boolean {
  if (!isPilotInviteOnlyEnabled(env)) {
    return true;
  }
  const normalized = normalizePilotEmail(email);
  if (!normalized) {
    return false;
  }
  const allowed = parsePilotAllowedEmails(env);
  if (allowed.size === 0) {
    return false;
  }
  return allowed.has(normalized);
}

export function isPilotLiveInferenceEnabled(env: PilotEnvSource = process.env): boolean {
  return (env.PILOT_LIVE_INFERENCE_ENABLED ?? '').trim().toLowerCase() === 'true';
}

/**
 * Resolves the single active financing mode for live script generation.
 * Never allows silent fallback from customer BYOK to the Founder-sponsored key.
 */
export function resolvePilotFinancingMode(env: PilotEnvSource = process.env): PilotFinancingMode {
  const raw = (env.PILOT_FINANCING_MODE ?? '').trim().toUpperCase();
  if (!raw) {
    return isPilotInviteOnlyEnabled(env) ? 'FOUNDER_SPONSORED' : 'CUSTOMER_BYOK';
  }
  if (raw === 'FOUNDER_SPONSORED' || raw === 'CUSTOMER_BYOK' || raw === 'DISABLED') {
    return raw;
  }
  return 'DISABLED';
}

export function resolvePilotMaxGenerations(env: PilotEnvSource = process.env): number {
  const parsed = Number.parseInt((env.PILOT_MAX_GENERATIONS ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_GENERATIONS;
  }
  return Math.min(MAX_MAX_GENERATIONS, Math.max(MIN_MAX_GENERATIONS, parsed));
}

export function resolvePilotRateLimitCooldownMs(env: PilotEnvSource = process.env): number {
  const parsed = Number.parseInt((env.PILOT_RATE_LIMIT_COOLDOWN_MS ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_COOLDOWN_MS;
  }
  return Math.min(MAX_COOLDOWN_MS, parsed);
}

/**
 * Validates and resolves all required pilot cost-containment bounds.
 * Fails closed whenever `PILOT_MAX_GENERATIONS` or `PILOT_MAX_ESTIMATED_SPEND_USD`
 * is missing/invalid, or when model/token/retry/timeout overrides exceed safe ceilings.
 */
export function resolvePilotCostControls(
  env: PilotEnvSource = process.env,
): PilotCostControlValidation {
  const missingOrInvalid: string[] = [];

  const rawMaxGen = (env.PILOT_MAX_GENERATIONS ?? '').trim();
  const maxGenerations = Number(rawMaxGen);
  if (
    !rawMaxGen ||
    !Number.isInteger(maxGenerations) ||
    maxGenerations < MIN_MAX_GENERATIONS ||
    maxGenerations > MAX_MAX_GENERATIONS
  ) {
    missingOrInvalid.push('PILOT_MAX_GENERATIONS');
  }

  const rawMaxSpend = (env.PILOT_MAX_ESTIMATED_SPEND_USD ?? '').trim();
  const maxEstimatedSpendUsd = Number(rawMaxSpend);
  if (
    !rawMaxSpend ||
    !Number.isFinite(maxEstimatedSpendUsd) ||
    maxEstimatedSpendUsd <= 0 ||
    maxEstimatedSpendUsd > MAX_SPEND_USD_CEILING
  ) {
    missingOrInvalid.push('PILOT_MAX_ESTIMATED_SPEND_USD');
  }

  const modelId = (env.PILOT_MODEL_ID ?? '').trim() || PILOT_DEFAULT_MODEL;
  if (!PILOT_ALLOWED_MODELS.has(modelId)) {
    missingOrInvalid.push('PILOT_MODEL_ID');
  }

  const rawMaxTokens = (env.PILOT_MAX_OUTPUT_TOKENS ?? '').trim();
  const maxOutputTokens = rawMaxTokens ? Number(rawMaxTokens) : DEFAULT_MAX_OUTPUT_TOKENS;
  if (
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < MIN_OUTPUT_TOKENS ||
    maxOutputTokens > MAX_OUTPUT_TOKENS
  ) {
    missingOrInvalid.push('PILOT_MAX_OUTPUT_TOKENS');
  }

  const rawMaxRetries = (env.PILOT_MAX_RETRIES ?? '').trim();
  const maxRetries = rawMaxRetries ? Number(rawMaxRetries) : DEFAULT_MAX_RETRIES;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > MAX_RETRIES_CEILING) {
    missingOrInvalid.push('PILOT_MAX_RETRIES');
  }

  const rawTimeoutMs = (env.PILOT_TIMEOUT_MS ?? '').trim();
  const timeoutMs = rawTimeoutMs ? Number(rawTimeoutMs) : DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    missingOrInvalid.push('PILOT_TIMEOUT_MS');
  }

  const rawPerAttempt = (env.PILOT_ESTIMATED_COST_PER_ATTEMPT_USD ?? '').trim();
  let estimatedCostPerAttemptMicroUsd = DEFAULT_ESTIMATED_COST_PER_ATTEMPT_MICROUSD;
  if (rawPerAttempt) {
    const parsedPerAttempt = Number(rawPerAttempt);
    if (!Number.isFinite(parsedPerAttempt) || parsedPerAttempt <= 0 || parsedPerAttempt > 5) {
      missingOrInvalid.push('PILOT_ESTIMATED_COST_PER_ATTEMPT_USD');
    } else {
      estimatedCostPerAttemptMicroUsd = Math.max(1, Math.round(parsedPerAttempt * MICROUSD_PER_USD));
    }
  }

  if (missingOrInvalid.length > 0) {
    return { ok: false, missingOrInvalid };
  }

  return {
    ok: true,
    config: {
      maxGenerations,
      maxEstimatedSpendUsd,
      maxEstimatedSpendMicroUsd: Math.round(maxEstimatedSpendUsd * MICROUSD_PER_USD),
      estimatedCostPerAttemptMicroUsd,
      modelId,
      maxOutputTokens,
      maxRetries,
      timeoutMs,
      cooldownMs: resolvePilotRateLimitCooldownMs(env),
      inFlightLockMs: Math.max(
        DEFAULT_IN_FLIGHT_LOCK_MS,
        (maxRetries + 1) * timeoutMs + maxRetries * 5_000 + 15_000,
      ),
    },
  };
}

/**
 * Server-only OpenRouter key for Founder-sponsored pilot inference.
 * Never return or log this value in HTTP responses, telemetry, or error messages.
 */
export function resolvePilotSponsoredOpenRouterKey(env: PilotEnvSource = process.env): string | null {
  const key = (env.PILOT_OPENROUTER_API_KEY ?? '').trim();
  return key.length >= 10 ? key : null;
}

/**
 * Resolves the pilot-scoped HTTP-Referer header sent to OpenRouter so pilot traffic
 * is never attributed to the production origin.
 */
export function resolvePilotRefererOrigin(env: PilotEnvSource = process.env): string {
  const candidate = (env.APP_URL ?? env.BETTER_AUTH_URL ?? env.WORKER_TECHNICAL_URL ?? '').trim().replace(/\/+$/, '');
  if (candidate && candidate.startsWith('https://') && !candidate.includes('REPLACE_WITH_')) {
    return candidate;
  }
  return PILOT_TECHNICAL_ORIGIN;
}
