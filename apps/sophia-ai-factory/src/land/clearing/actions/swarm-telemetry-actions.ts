'use server';

/**
 * Server Actions: Swarm v2 Telemetry and Consensus State Operations
 * @module land/clearing/actions/swarm-telemetry-actions
 */

import type {
  SwarmV2ConsensusState,
  HeartbeatTelemetryV2Input,
  ConsensusTelemetryResult,
  ClearingActionError,
} from '@/seed/types/multi-asset-clearing';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  getSwarmV2State,
  updateSwarmV2Heartbeat,
} from '@/tree/swarm/swarm-v2-mesh-coordinator';
import { requireAuth, getRequiredD1 } from './common';

/**
 * 5. Get Swarm v2 Consensus State Action
 * Returns active Raft-BFT cluster topology and sub-10ms latency metrics.
 */
export async function getSwarmV2ConsensusStateAction(): Promise<
  Result<SwarmV2ConsensusState, ClearingActionError>
> {
  try {
    await requireAuth();
    const db = await getRequiredD1();
    const state = await getSwarmV2State(db);

    if (!state) {
      return failure({
        code: 'CONSENSUS_STATE_NOT_INITIALIZED',
        message: 'Swarm v2 consensus state has not been initialized in D1.',
      });
    }

    return success(state);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to get Swarm v2 consensus state', { error: message });
    return failure({
      code: 'GET_CONSENSUS_STATE_FAILED',
      message,
    });
  }
}

/**
 * 6. Record Swarm v2 Heartbeat Action
 * Ingests node ping and updates EMA latency.
 */
export async function recordSwarmV2HeartbeatAction(
  input: HeartbeatTelemetryV2Input,
): Promise<Result<ConsensusTelemetryResult, ClearingActionError>> {
  try {
    const db = await getRequiredD1();
    const result = await updateSwarmV2Heartbeat(db, input);
    return success(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to record Swarm v2 heartbeat', { error: message, input });
    return failure({
      code: 'RECORD_HEARTBEAT_FAILED',
      message,
    });
  }
}
