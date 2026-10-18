/**
 * Mission Preflight Failure Result Builder
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/preflight-failure-builder
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  MissionPreflightChecklist,
  MissionPreflightOptions,
  MissionPreflightResult,
  PreflightGateCheck,
} from './types';

/**
 * Helper to construct a failed preflight result while filling passed gates.
 */
export function buildPreflightFailure(
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
