/**
 * Cloudflare Worker runtime env/secret resolver for manual bank transfer (G3).
 *
 * Security invariant:
 * - Never hardcode real bank account numbers, holder names, or secrets in code or wrangler.toml.
 * - Read exclusively from Cloudflare runtime bindings (Wrangler secrets) or process.env in tests.
 * - Returns `{ configured: false }` cleanly when secrets are not yet provisioned.
 *
 * Layer: seed (foundational config).
 * @module seed/config/pilot-bank-config
 */

import { sha256Hex } from '@/seed/security/token-hash';

export interface PilotBankEnvSource {
  PILOT_BANK_NAME?: string;
  PILOT_BANK_ACCOUNT_NUMBER?: string;
  PILOT_BANK_ACCOUNT_HOLDER?: string;
  PILOT_BANK_TRANSFER_PREFIX?: string;
}

export interface PilotBankConfigured {
  readonly configured: true;
  readonly bankName: string;
  readonly accountNumber: string;
  readonly accountHolder: string;
  readonly transferPrefix: string;
}

export interface PilotBankUnconfigured {
  readonly configured: false;
  readonly transferPrefix: string;
  readonly reason: 'PILOT_BANK_NOT_CONFIGURED';
}

export type PilotBankConfig = PilotBankConfigured | PilotBankUnconfigured;

const DEFAULT_TRANSFER_PREFIX = 'SOPHIA-PILOT';

function cleanEnvValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizePrefix(raw: string): string {
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  return normalized.length >= 3 ? normalized : DEFAULT_TRANSFER_PREFIX;
}

/**
 * Pure synchronous resolver from an explicit env object (or process.env).
 */
export function resolvePilotBankConfigFromEnv(
  env: PilotBankEnvSource = process.env as PilotBankEnvSource,
): PilotBankConfig {
  const bankName = cleanEnvValue(env.PILOT_BANK_NAME);
  const accountNumber = cleanEnvValue(env.PILOT_BANK_ACCOUNT_NUMBER);
  const accountHolder = cleanEnvValue(env.PILOT_BANK_ACCOUNT_HOLDER);
  const transferPrefix = sanitizePrefix(cleanEnvValue(env.PILOT_BANK_TRANSFER_PREFIX));

  if (!bankName || !accountNumber || !accountHolder) {
    return {
      configured: false,
      transferPrefix,
      reason: 'PILOT_BANK_NOT_CONFIGURED',
    };
  }

  return {
    configured: true,
    bankName,
    accountNumber,
    accountHolder,
    transferPrefix,
  };
}

/**
 * Async resolver that reads Cloudflare Worker runtime env via getCloudflareContext first,
 * falling back cleanly to process.env for local dev and Vitest suites.
 */
export async function resolvePilotBankConfig(
  envOverride?: PilotBankEnvSource,
): Promise<PilotBankConfig> {
  if (envOverride) {
    return resolvePilotBankConfigFromEnv(envOverride);
  }

  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    const cfEnv = ctx?.env as unknown as PilotBankEnvSource | undefined;
    if (cfEnv) {
      const fromCf = resolvePilotBankConfigFromEnv(cfEnv);
      if (fromCf.configured) return fromCf;
    }
  } catch {
    // Non-Cloudflare runtime (local dev / Vitest) — fall through to process.env.
  }

  return resolvePilotBankConfigFromEnv(process.env as PilotBankEnvSource);
}

/**
 * Hashes the exact full order ID with SHA-256, retaining 128 bits in the memo.
 * At most 49 ASCII characters: 16-character prefix, separator, 32 hex digits.
 * Database uniqueness is the final guard against reference reuse.
 */
export async function buildManualTransferReference(
  orderId: string,
  transferPrefix: string = DEFAULT_TRANSFER_PREFIX,
): Promise<string> {
  const prefix = sanitizePrefix(transferPrefix);
  const suffix = (await sha256Hex(orderId)).slice(0, 32).toUpperCase();
  return `${prefix}-${suffix}`;
}
