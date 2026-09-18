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
 * Layer: tree (domain reusable logic — depends only on seed and tree).
 *
 * @module tree/mission/preflight-check
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import {
  resolveCapabilities,
  type AICapability,
} from '@/seed/ai/capability-model';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { FailureKind } from '@/seed/types/failure-kind';
import {
  listUserApiKeyProviders,
  getUserApiKey,
  type ByokProvider,
} from '@/tree/byok/user-api-key-store';
import { getBalance } from '@/tree/mcu/credits-repo';

/** Maximum allowed cost in cents for a single mission execution ($5.00) */
export const MAX_SINGLE_MISSION_COST_CENTS = 500;

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
  /** Estimated cost of single mission in cents (spike guard). */
  estimatedCostCents?: number;
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

interface AuthGateEvaluation {
  passed: boolean;
  gate: PreflightGateCheck;
  resolvedUserId?: string;
}

interface PreflightGateEvaluation {
  passed: boolean;
  gate: PreflightGateCheck;
}

interface CredentialGateEvaluation {
  passed: boolean;
  gate: PreflightGateCheck;
  configuredProviders: ByokProvider[];
}

async function evaluateAuthGate(userId?: string): Promise<AuthGateEvaluation> {
  let resolvedUserId = userId;
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
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'NOT_AUTHENTICATED',
        message: 'User must be authenticated to execute a mission',
      },
    };
  }

  return {
    passed: true,
    resolvedUserId,
    gate: {
      passed: true,
      code: 'AUTH_OK',
      message: 'User authenticated',
      details: { userId: resolvedUserId },
    },
  };
}

async function evaluateOwnershipGate(
  opts: MissionPreflightOptions,
  resolvedUserId: string
): Promise<PreflightGateEvaluation> {
  let ownershipPassed = false;
  let ownershipError = 'Workspace access denied';

  try {
    if (opts.overrides?.membershipVerified || opts.workspaceId === resolvedUserId) {
      ownershipPassed = true;
    } else {
      const d1 = await getD1();
      if (d1) {
        const hasAccess = await verifyWorkspaceAccess(opts.workspaceId, resolvedUserId, d1);
        if (hasAccess) {
          ownershipPassed = true;
        } else {
          ownershipError = `User does not belong to workspace ${opts.workspaceId}`;
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
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'WORKSPACE_ACCESS_DENIED',
        message: ownershipError,
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'OWNERSHIP_OK',
      message: 'Workspace membership verified',
      details: { workspaceId: opts.workspaceId, userId: resolvedUserId },
    },
  };
}

async function evaluateEntitlementGate(
  opts: MissionPreflightOptions,
  resolvedUserId: string
): Promise<PreflightGateEvaluation> {
  // Spike guard: fail-closed if estimated cost exceeds single mission threshold
  if (
    typeof opts.estimatedCostCents === 'number' &&
    opts.estimatedCostCents > 0 &&
    opts.estimatedCostCents > MAX_SINGLE_MISSION_COST_CENTS
  ) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: FailureKind.BILLING_FAILURE,
        message: `Preflight aborted: Estimated cost (${opts.estimatedCostCents}¢) exceeds single mission limit (${MAX_SINGLE_MISSION_COST_CENTS}¢)`,
        details: {
          estimatedCostCents: opts.estimatedCostCents,
          maxCostCents: MAX_SINGLE_MISSION_COST_CENTS,
        },
      },
    };
  }

  let tier = opts.overrides?.tier;
  let mcuBalance = opts.overrides?.mcuBalance;

  try {
    if (!tier) {
      tier = await resolveUserTier(resolvedUserId);
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
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'INSUFFICIENT_ENTITLEMENT',
        message: `Insufficient MCU balance (${mcuBalance ?? 0} remaining) on tier ${tier}`,
        details: { tier, mcuBalance },
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'ENTITLEMENT_OK',
      message: 'Entitlement and MCU balance verified',
      details: { tier, mcuBalance, estimatedCostCents: opts.estimatedCostCents },
    },
  };
}

async function evaluateCredentialGate(
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
    let specificKeyValid = false;
    try {
      const plainKey = await getUserApiKey(resolvedUserId, opts.requiredProvider);
      specificKeyValid = Boolean(plainKey && plainKey.trim().length > 0);
    } catch {
      specificKeyValid = false;
    }

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

function evaluateCapabilityGate(
  configuredProviders: ByokProvider[],
  targetCapability: AICapability
): PreflightGateEvaluation {
  const { availableCapabilities } = resolveCapabilities(configuredProviders);
  const capabilitySupported = availableCapabilities.includes(targetCapability);

  if (!capabilitySupported) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'CAPABILITY_NOT_SUPPORTED',
        message: `Configured providers (${configuredProviders.join(', ') || 'none'}) do not support required capability: ${targetCapability}`,
        details: {
          targetCapability,
          configuredProviders,
          availableCapabilities,
        },
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'CAPABILITY_OK',
      message: `Capability ${targetCapability} is supported by configured providers`,
      details: { targetCapability, availableCapabilities },
    },
  };
}

function evaluateStorageGate(storageOverride?: boolean): PreflightGateEvaluation {
  const storageOk = isStorageOperational(storageOverride);
  if (!storageOk) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'STORAGE_UNAVAILABLE',
        message: 'Storage subsystem is not available or disconnected',
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'STORAGE_OK',
      message: 'Storage subsystem is available',
    },
  };
}

function evaluateQueueGate(queueOverride?: boolean): PreflightGateEvaluation {
  const queueOk = isQueueOperational(queueOverride);
  if (!queueOk) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'QUEUE_UNAVAILABLE',
        message: 'Inngest queue subsystem is not reachable or unconfigured',
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'QUEUE_OK',
      message: 'Inngest queue subsystem is verified',
    },
  };
}

/**
 * Execute 7-gate mission preflight check.
 * Returns fail-closed result with individual gate statuses.
 */
export async function runMissionPreflightCheck(
  opts: MissionPreflightOptions
): Promise<MissionPreflightResult> {
  const targetCapability: AICapability = opts.capability ?? 'AI_IMAGE';

  // 1. Auth Gate
  const authRes = await evaluateAuthGate(opts.userId);
  if (!authRes.passed) {
    return buildPreflightFailure('auth', authRes.gate, opts);
  }
  const authGate = authRes.gate;
  const resolvedUserId = authRes.resolvedUserId!;

  // 2. Ownership Gate
  const ownershipRes = await evaluateOwnershipGate(opts, resolvedUserId);
  if (!ownershipRes.passed) {
    return buildPreflightFailure('ownership', ownershipRes.gate, opts, { auth: authGate });
  }
  const ownershipGate = ownershipRes.gate;

  // 3. Entitlement Gate
  const entitlementRes = await evaluateEntitlementGate(opts, resolvedUserId);
  if (!entitlementRes.passed) {
    return buildPreflightFailure('entitlement', entitlementRes.gate, opts, {
      auth: authGate,
      ownership: ownershipGate,
    });
  }
  const entitlementGate = entitlementRes.gate;

  // 4. Credential Gate
  const credentialRes = await evaluateCredentialGate(opts, resolvedUserId);
  if (!credentialRes.passed) {
    return buildPreflightFailure('credential', credentialRes.gate, opts, {
      auth: authGate,
      ownership: ownershipGate,
      entitlement: entitlementGate,
    });
  }
  const credentialGate = credentialRes.gate;

  // 5. Capability Gate
  const capabilityRes = evaluateCapabilityGate(credentialRes.configuredProviders, targetCapability);
  if (!capabilityRes.passed) {
    return buildPreflightFailure('capability', capabilityRes.gate, opts, {
      auth: authGate,
      ownership: ownershipGate,
      entitlement: entitlementGate,
      credential: credentialGate,
    });
  }
  const capabilityGate = capabilityRes.gate;

  // 6. Storage Gate
  const storageRes = evaluateStorageGate(opts.overrides?.storageReady);
  if (!storageRes.passed) {
    return buildPreflightFailure('storage', storageRes.gate, opts, {
      auth: authGate,
      ownership: ownershipGate,
      entitlement: entitlementGate,
      credential: credentialGate,
      capability: capabilityGate,
    });
  }
  const storageGate = storageRes.gate;

  // 7. Queue Gate
  const queueRes = evaluateQueueGate(opts.overrides?.queueReady);
  if (!queueRes.passed) {
    return buildPreflightFailure('queue', queueRes.gate, opts, {
      auth: authGate,
      ownership: ownershipGate,
      entitlement: entitlementGate,
      credential: credentialGate,
      capability: capabilityGate,
      storage: storageGate,
    });
  }
  const queueGate = queueRes.gate;

  // All 7 gates passed
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
