/**
 * Production-Safe Mission Preflight Checklist: Orchestrator Engine.
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/preflight-orchestrator
 */

import type {
  MissionPreflightOptions,
  MissionPreflightResult,
} from './types';
import { evaluateAuthGate } from './auth-gate';
import { evaluateOwnershipGate } from './ownership-gate';
import { evaluateEntitlementGate } from './entitlement-gate';
import { evaluateCredentialGate } from './credential-gate';
import { evaluateCapabilityGate } from './capability-gate';
import { evaluateStorageGate, evaluateQueueGate } from './readiness-evaluator';
import { buildPreflightFailure } from './preflight-failure-builder';

export { buildPreflightFailure };

/**
 * Execute 7-gate mission preflight check.
 * Returns fail-closed result with individual gate statuses.
 */
export async function runMissionPreflightCheck(
  opts: MissionPreflightOptions
): Promise<MissionPreflightResult> {
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
  const capabilityRes = evaluateCapabilityGate(credentialRes.configuredProviders, opts);
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
