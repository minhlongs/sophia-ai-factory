/**
 * Invite-only access, kill-switch, and quota policy for the First Real Customer Pilot.
 *
 * Pure foundational helpers (seed layer — zero external or DB dependencies).
 * Fail-closed when `PILOT_INVITE_ONLY=true` and allowlist is empty or email is absent.
 *
 * @module seed/pilot/pilot-access-policy
 */

export const PILOT_POLICY_VERSION = '2026-11-pilot-v1';

export const PILOT_EVENT_NAMES = [
  'INVITE_ACCEPTED',
  'FIRST_LOGIN',
  'BRIEF_SUBMITTED',
  'GENERATION_REQUESTED',
  'GENERATION_SUCCEEDED',
  'GENERATION_FAILED',
  'SCRIPT_REVIEWED',
  'SCRIPT_EDITED',
  'SCRIPT_EXPORTED',
  'CUSTOMER_FEEDBACK_SUBMITTED',
] as const;

export type PilotEventName = (typeof PILOT_EVENT_NAMES)[number];

export type PilotFundingMode = 'customer_byok' | 'founder_sponsored' | 'none';

export interface PilotQuotaSnapshot {
  readonly usedGenerations: number;
  readonly maxGenerations: number;
  readonly remainingGenerations: number;
  readonly lastGenerationAtIso: string | null;
}

export interface PilotStatusSnapshot {
  readonly inviteOnly: boolean;
  readonly liveInferenceEnabled: boolean;
  readonly policyVersion: string;
  readonly consentAccepted: boolean;
  readonly consentAcceptedAtIso: string | null;
  readonly fundingMode: PilotFundingMode;
  readonly quota: PilotQuotaSnapshot;
}

export interface PilotEnvSource {
  readonly [key: string]: string | undefined;
  readonly PILOT_INVITE_ONLY?: string;
  readonly PILOT_ALLOWED_EMAILS?: string;
  readonly PILOT_LIVE_INFERENCE_ENABLED?: string;
  readonly PILOT_MAX_GENERATIONS?: string;
  readonly PILOT_RATE_LIMIT_COOLDOWN_MS?: string;
  readonly PILOT_OPENROUTER_API_KEY?: string;
  readonly PAYMENTS_ENABLED?: string;
  readonly B2_PUBLISH_ENABLED?: string;
}

const DEFAULT_MAX_GENERATIONS = 20;
const MIN_MAX_GENERATIONS = 1;
const MAX_MAX_GENERATIONS = 100;
const DEFAULT_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 300_000;

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

/**
 * Returns true if the given email is permitted to access the pilot.
 * When `PILOT_INVITE_ONLY` is false/unset, returns true (non-pilot deployments unaffected).
 * When `PILOT_INVITE_ONLY=true`, fails closed unless email matches an allowlisted entry.
 */
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
 * Server-only OpenRouter key for Founder-sponsored pilot inference.
 * Never return or log this value in HTTP responses, telemetry, or error messages.
 */
export function resolvePilotSponsoredOpenRouterKey(env: PilotEnvSource = process.env): string | null {
  const key = (env.PILOT_OPENROUTER_API_KEY ?? '').trim();
  return key.length >= 10 ? key : null;
}
