/**
 * Production-Safe Mission Preflight Checklist: Credential Gate.
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/credential-gate
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  listUserApiKeyProviders,
  getUserApiKey,
  type ByokProvider,
} from '@/tree/byok/user-api-key-store';
import type { MissionPreflightOptions, CredentialGateEvaluation } from './types';

export async function isProviderKeyValid(userId: string, provider: ByokProvider): Promise<boolean> {
  try {
    const key = await getUserApiKey(userId, provider);
    return Boolean(key && key.trim().length > 0);
  } catch {
    return false;
  }
}

export async function getValidDecryptedProviders(userId: string, providers: ByokProvider[]): Promise<ByokProvider[]> {
  const valid: ByokProvider[] = [];
  for (const provider of providers) {
    if (await isProviderKeyValid(userId, provider)) {
      valid.push(provider);
    }
  }
  return valid;
}

export async function evaluateCredentialGate(
  opts: MissionPreflightOptions,
  resolvedUserId: string
): Promise<CredentialGateEvaluation> {
  let configuredProviders: ByokProvider[] = [];
  try {
    configuredProviders = await listUserApiKeyProviders(resolvedUserId);
  } catch (err) {
    logger.warn('[MissionPreflight] Failed listing user API keys', {
      userId: resolvedUserId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (opts.requiredProvider) {
    const specificKeyValid = await isProviderKeyValid(resolvedUserId, opts.requiredProvider);
    if (!specificKeyValid) {
      return {
        passed: false,
        configuredProviders,
        gate: {
          passed: false,
          code: 'MISSING_PROVIDER_CREDENTIAL',
          message: `Missing or invalid API key for required provider: ${opts.requiredProvider}`,
          details: { requiredProvider: opts.requiredProvider },
        },
      };
    }
  } else if (configuredProviders.length === 0) {
    return {
      passed: false,
      configuredProviders,
      gate: {
        passed: false,
        code: 'NO_BYOK_CREDENTIALS',
        message: 'No BYOK provider credentials have been configured for user',
        details: { configuredProviders },
      },
    };
  } else {
    const validProviders = await getValidDecryptedProviders(resolvedUserId, configuredProviders);
    if (validProviders.length === 0) {
      return {
        passed: false,
        configuredProviders,
        gate: {
          passed: false,
          code: 'INVALID_BYOK_CREDENTIAL',
          message: 'Configured BYOK credentials failed AES-256-GCM verification or decryption',
          details: { configuredProviders },
        },
      };
    }
    configuredProviders = validProviders;
  }

  return {
    passed: true,
    configuredProviders,
    gate: {
      passed: true,
      code: 'CREDENTIAL_OK',
      message: 'Provider credentials verified',
      details: {
        providersCount: configuredProviders.length,
        requiredProvider: opts.requiredProvider ?? null,
      },
    },
  };
}
