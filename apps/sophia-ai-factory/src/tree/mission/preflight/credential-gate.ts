/**
 * Production-Safe Mission Preflight Checklist: Credential Gate.
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/credential-gate
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  listUserApiKeyProviders,
  lookupUserApiKey,
  type ByokProvider,
} from '@/tree/byok/user-api-key-store';
import type { MissionPreflightOptions, CredentialGateEvaluation } from './types';

/**
 * Whether a stored credential is usable. An unreadable store is reported
 * separately from an absent key: telling a customer to connect a key they
 * already connected is a support failure, and starting a mission on a platform
 * fallback while their own credential state is unknown is worse.
 */
export type ProviderKeyState =
  | { usable: true }
  | { usable: false; reason: 'NOT_CONFIGURED' }
  | { usable: false; reason: 'STORE_UNAVAILABLE'; status: string };

export async function checkProviderKeyState(
  userId: string,
  provider: ByokProvider,
): Promise<ProviderKeyState> {
  const lookup = await lookupUserApiKey(userId, provider);
  if (lookup.status === 'FOUND') {
    return lookup.key.trim().length > 0
      ? { usable: true }
      : { usable: false, reason: 'NOT_CONFIGURED' };
  }
  if (lookup.status === 'NOT_CONFIGURED') {
    return { usable: false, reason: 'NOT_CONFIGURED' };
  }
  return { usable: false, reason: 'STORE_UNAVAILABLE', status: lookup.status };
}

export async function isProviderKeyValid(userId: string, provider: ByokProvider): Promise<boolean> {
  const state = await checkProviderKeyState(userId, provider);
  return state.usable;
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
    const keyState = await checkProviderKeyState(resolvedUserId, opts.requiredProvider);
    if (!keyState.usable) {
      // A store or decryption outage is not "key absent": the customer may
      // already have connected it. Block the mission with a distinct code so
      // they are never told to reconnect what they already provided.
      const unreadable = keyState.reason === 'STORE_UNAVAILABLE';
      if (unreadable) {
        logger.warn('[MissionPreflight] Required provider credential could not be read', {
          userId: resolvedUserId,
          requiredProvider: opts.requiredProvider,
          status: keyState.status,
        });
      }
      return {
        passed: false,
        configuredProviders,
        gate: {
          passed: false,
          code: unreadable ? 'PROVIDER_CREDENTIAL_UNREADABLE' : 'MISSING_PROVIDER_CREDENTIAL',
          message: unreadable
            ? `Could not read the saved API key for ${opts.requiredProvider}. Please retry in a moment.`
            : `Missing or invalid API key for required provider: ${opts.requiredProvider}`,
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
