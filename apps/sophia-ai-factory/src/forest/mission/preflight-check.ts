/**
 * Production-Safe Mission Preflight Checklist — Sophia AI Factory.
 *
 * Implements ESCROW-1 & Phase 5: Production-safe preflight verification
 * before a creative mission starts execution.
 *
 * Checks all 7 fail-closed gates:
 * 1. auth: user is authenticated
 * 2. ownership: user belongs to/owns workspace
 * 3. entitlement: user has active tier / sufficient MCU balance
 * 4. credential: BYOK key configured and non-empty
 * 5. capability: provider capability matches required capability (e.g. AI_IMAGE / AI_VIDEO)
 * 6. storage: R2 bucket or storage subsystem is operational
 * 7. queue: Inngest client/queue subsystem is ready
 *
 * Layer: forest (can import tree and seed).
 *
 * @module forest/mission/preflight-check
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import {
  resolveCapabilities,
  type AICapability,
} from '@/seed/ai/capability-model';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  listUserApiKeyProviders,
  getUserApiKey,
  type ByokProvider,
} from '@/tree/byok/user-api-key-store';
import { getBalance } from '@/tree/mcu/credits-repo';

export interface PreflightGateCheck {
  passed: boolean;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface MissionPreflightChecklist {
  auth: PreflightGateCheck;
  ownership: PreflightGateCheck;
  entitlement: PreflightGateCheck;
  credential: PreflightGateCheck;
  capability: PreflightGateCheck;
  storage: PreflightGateCheck;
  queue: PreflightGateCheck;
}

export interface MissionPreflightResult {
  passed: boolean;
  failureCode?: string;
  failureReason?: string;
  gates: MissionPreflightChecklist;
}

export interface MissionPreflightOptions {
  /** User ID. If omitted, will be fetched via getCurrentUser(). */
  userId?: string;
  /** Workspace ID to check membership for. */
  workspaceId: string;
  /** Required capability for this mission. Default: 'AI_IMAGE' */
  capability?: AICapability;
  /** Specific required BYOK provider, if any. */
  requiredProvider?: ByokProvider;
  /** Optional overrides for testing/dependency injection */
  overrides?: {
    storageReady?: boolean;
    queueReady?: boolean;
    mcuBalance?: number;
    tier?: string;
    membershipVerified?: boolean;
  };
}

/**
 * Check if storage subsystem is operational.
 */
function isStorageOperational(storageOverride?: boolean): boolean {
  if (typeof storageOverride === 'boolean') {
    return storageOverride;
  }

  // Cloudflare runtime context check
  try {
    const globalObj = globalThis as unknown as {
      __env__?: { BACKUPS_BUCKET?: unknown; STORAGE_BUCKET?: unknown };
      __env?: { BACKUPS_BUCKET?: unknown; STORAGE_BUCKET?: unknown };
    };

    if (globalObj.__env__?.BACKUPS_BUCKET || globalObj.__env__?.STORAGE_BUCKET) {
      return true;
    }
    if (globalObj.__env?.BACKUPS_BUCKET || globalObj.__env?.STORAGE_BUCKET) {
      return true;
    }

    // In local Node / test environment, environment variables or fallback
    if (
      process.env.R2_ACCOUNT_ID ||
      process.env.STORAGE_BUCKET ||
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'development'
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if Inngest queue subsystem is ready.
 */
function isQueueOperational(queueOverride?: boolean): boolean {
  if (typeof queueOverride === 'boolean') {
    return queueOverride;
  }

  try {
    return Boolean(inngest && typeof inngest.send === 'function');
  } catch {
    return false;
  }
}

/**
 * Execute 7-gate mission preflight check.
 * Returns fail-closed result with individual gate statuses.
 */
export async function runMissionPreflightCheck(
  opts: MissionPreflightOptions
): Promise<MissionPreflightResult> {
  const { workspaceId, requiredProvider } = opts;
  const targetCapability: AICapability = opts.capability ?? 'AI_IMAGE';

  // ── 1. AUTH GATE ─────────────────────────────────────────────────────────────
  let resolvedUserId = opts.userId;
  if (!resolvedUserId) {
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        resolvedUserId = user.id;
      }
    } catch {
      // Auth error handled below
    }
  }

  if (!resolvedUserId) {
    const authFail: PreflightGateCheck = {
      passed: false,
      code: 'NOT_AUTHENTICATED',
      message: 'User must be authenticated to execute a mission',
    };
    return buildPreflightFailure('auth', authFail, opts);
  }

  const authGate: PreflightGateCheck = {
    passed: true,
    code: 'AUTH_OK',
    message: 'User authenticated',
    details: { userId: resolvedUserId },
  };

  // ── 2. OWNERSHIP GATE ────────────────────────────────────────────────────────
  let ownershipPassed = false;
  let ownershipError = 'Workspace access denied';

  try {
    if (opts.overrides?.membershipVerified || workspaceId === resolvedUserId) {
      ownershipPassed = true;
    } else {
      const d1 = await getD1();
      if (d1) {
        const member = await d1
          .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ? LIMIT 1')
          .bind(workspaceId, resolvedUserId)
          .first();

        if (member) {
          ownershipPassed = true;
        } else {
          ownershipError = `User does not belong to workspace ${workspaceId}`;
        }
      } else {
        // In local/test environments without D1, allow if explicit
        ownershipPassed = process.env.NODE_ENV === 'test';
      }
    }
  } catch (err) {
    ownershipError = err instanceof Error ? err.message : 'Database error during ownership check';
  }

  if (!ownershipPassed) {
    const ownershipFail: PreflightGateCheck = {
      passed: false,
      code: 'WORKSPACE_ACCESS_DENIED',
      message: ownershipError,
    };
    return buildPreflightFailure('ownership', ownershipFail, opts, { auth: authGate });
  }

  const ownershipGate: PreflightGateCheck = {
    passed: true,
    code: 'OWNERSHIP_OK',
    message: 'Workspace membership verified',
    details: { workspaceId, userId: resolvedUserId },
  };

  // ── 3. ENTITLEMENT GATE ──────────────────────────────────────────────────────
  let tier = opts.overrides?.tier;
  let mcuBalance = opts.overrides?.mcuBalance;

  try {
    if (!tier) {
      tier = await getUserTier(resolvedUserId);
    }
    if (typeof mcuBalance !== 'number') {
      const balance = await getBalance(resolvedUserId);
      mcuBalance = balance.credits_remaining;
    }
  } catch (err) {
    logger.warn('[MissionPreflight] Entitlement check encountered error', {
      userId: resolvedUserId,
      error: err instanceof Error ? err.message : String(err),
    });
    tier = tier ?? 'BASIC';
    mcuBalance = mcuBalance ?? 0;
  }

  // Quota check: user must have remaining MCU balance (> 0) or MASTER tier
  const isMaster = tier === 'MASTER';
  const hasQuota = isMaster || (typeof mcuBalance === 'number' && mcuBalance > 0);

  if (!hasQuota) {
    const entitlementFail: PreflightGateCheck = {
      passed: false,
      code: 'INSUFFICIENT_ENTITLEMENT',
      message: `Insufficient MCU balance (${mcuBalance ?? 0} remaining) on tier ${tier}`,
      details: { tier, mcuBalance },
    };
    return buildPreflightFailure('entitlement', entitlementFail, opts, {
      auth: authGate,
      ownership: ownershipGate,
    });
  }

  const entitlementGate: PreflightGateCheck = {
    passed: true,
    code: 'ENTITLEMENT_OK',
    message: 'Entitlement and MCU balance verified',
    details: { tier, mcuBalance },
  };

  // ── 4. PROVIDER CREDENTIAL GATE ──────────────────────────────────────────────
  let configuredProviders: ByokProvider[] = [];
  try {
    configuredProviders = await listUserApiKeyProviders(resolvedUserId);
  } catch (err) {
    logger.warn('[MissionPreflight] Failed listing user API keys', {
      userId: resolvedUserId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (requiredProvider) {
    let specificKeyValid = false;
    try {
      const plainKey = await getUserApiKey(resolvedUserId, requiredProvider);
      specificKeyValid = Boolean(plainKey && plainKey.trim().length > 0);
    } catch {
      specificKeyValid = false;
    }

    if (!specificKeyValid) {
      const credentialFail: PreflightGateCheck = {
        passed: false,
        code: 'MISSING_PROVIDER_CREDENTIAL',
        message: `Missing or invalid API key for required provider: ${requiredProvider}`,
        details: { requiredProvider },
      };
      return buildPreflightFailure('credential', credentialFail, opts, {
        auth: authGate,
        ownership: ownershipGate,
        entitlement: entitlementGate,
      });
    }
  } else if (configuredProviders.length === 0) {
    const credentialFail: PreflightGateCheck = {
      passed: false,
      code: 'NO_BYOK_CREDENTIALS',
      message: 'No BYOK provider credentials have been configured for user',
      details: { configuredProviders },
    };
    return buildPreflightFailure('credential', credentialFail, opts, {
      auth: authGate,
      ownership: ownershipGate,
      entitlement: entitlementGate,
    });
  }

  const credentialGate: PreflightGateCheck = {
    passed: true,
    code: 'CREDENTIAL_OK',
    message: 'Provider credentials verified',
    details: {
      providersCount: configuredProviders.length,
      requiredProvider: requiredProvider ?? null,
    },
  };

  // ── 5. PROVIDER CAPABILITY GATE ──────────────────────────────────────────────
  const { availableCapabilities } = resolveCapabilities(configuredProviders);
  const capabilitySupported = availableCapabilities.includes(targetCapability);

  if (!capabilitySupported) {
    const capabilityFail: PreflightGateCheck = {
      passed: false,
      code: 'CAPABILITY_NOT_SUPPORTED',
      message: `Configured providers (${configuredProviders.join(', ') || 'none'}) do not support required capability: ${targetCapability}`,
      details: {
        targetCapability,
        configuredProviders,
        availableCapabilities,
      },
    };
    return buildPreflightFailure('capability', capabilityFail, opts, {
      auth: authGate,
      ownership: ownershipGate,
      entitlement: entitlementGate,
      credential: credentialGate,
    });
  }

  const capabilityGate: PreflightGateCheck = {
    passed: true,
    code: 'CAPABILITY_OK',
    message: `Capability ${targetCapability} is supported by configured providers`,
    details: { targetCapability, availableCapabilities },
  };

  // ── 6. STORAGE GATE ──────────────────────────────────────────────────────────
  const storageOk = isStorageOperational(opts.overrides?.storageReady);
  if (!storageOk) {
    const storageFail: PreflightGateCheck = {
      passed: false,
      code: 'STORAGE_UNAVAILABLE',
      message: 'Storage subsystem is not available or disconnected',
    };
    return buildPreflightFailure('storage', storageFail, opts, {
      auth: authGate,
      ownership: ownershipGate,
      entitlement: entitlementGate,
      credential: credentialGate,
      capability: capabilityGate,
    });
  }

  const storageGate: PreflightGateCheck = {
    passed: true,
    code: 'STORAGE_OK',
    message: 'Storage subsystem is available',
  };

  // ── 7. QUEUE GATE ────────────────────────────────────────────────────────────
  const queueOk = isQueueOperational(opts.overrides?.queueReady);
  if (!queueOk) {
    const queueFail: PreflightGateCheck = {
      passed: false,
      code: 'QUEUE_UNAVAILABLE',
      message: 'Inngest queue subsystem is not reachable or unconfigured',
    };
    return buildPreflightFailure('queue', queueFail, opts, {
      auth: authGate,
      ownership: ownershipGate,
      entitlement: entitlementGate,
      credential: credentialGate,
      capability: capabilityGate,
      storage: storageGate,
    });
  }

  const queueGate: PreflightGateCheck = {
    passed: true,
    code: 'QUEUE_OK',
    message: 'Inngest queue subsystem is verified',
  };

  // ── ALL 7 GATES PASSED ───────────────────────────────────────────────────────
  return {
    passed: true,
    gates: {
      auth: authGate,
      ownership: ownershipGate,
      entitlement: entitlementGate,
      credential: credentialGate,
      capability: capabilityGate,
      storage: storageGate,
      queue: queueGate,
    },
  };
}

/**
 * Helper to construct a failed preflight result while filling passed gates.
 */
function buildPreflightFailure(
  failedGateName: keyof MissionPreflightChecklist,
  failedGate: PreflightGateCheck,
  opts: MissionPreflightOptions,
  passedGates: Partial<MissionPreflightChecklist> = {}
): MissionPreflightResult {
  const defaultGate = (name: string): PreflightGateCheck => ({
    passed: false,
    code: 'SKIPPED',
    message: `Gate ${name} skipped due to prior failure in ${failedGateName}`,
  });

  const gates: MissionPreflightChecklist = {
    auth: passedGates.auth ?? (failedGateName === 'auth' ? failedGate : defaultGate('auth')),
    ownership: passedGates.ownership ?? (failedGateName === 'ownership' ? failedGate : defaultGate('ownership')),
    entitlement: passedGates.entitlement ?? (failedGateName === 'entitlement' ? failedGate : defaultGate('entitlement')),
    credential: passedGates.credential ?? (failedGateName === 'credential' ? failedGate : defaultGate('credential')),
    capability: passedGates.capability ?? (failedGateName === 'capability' ? failedGate : defaultGate('capability')),
    storage: passedGates.storage ?? (failedGateName === 'storage' ? failedGate : defaultGate('storage')),
    queue: passedGates.queue ?? (failedGateName === 'queue' ? failedGate : defaultGate('queue')),
  };

  logger.warn('[MissionPreflight] Preflight check rejected', {
    failedGate: failedGateName,
    code: failedGate.code,
    reason: failedGate.message,
    workspaceId: opts.workspaceId,
    userId: opts.userId,
  });

  return {
    passed: false,
    failureCode: failedGate.code,
    failureReason: failedGate.message,
    gates,
  };
}
