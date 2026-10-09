/**
 * Day-1 Orchestration Engine: runs all 11 CEO operational checkpoints.
 * Layer: tree (Domain operations; imports only from @/seed and @/tree)
 *
 * @module tree/handover/day1/day1-engine
 */

import type { D1Database } from '@/seed/db/client';
import type { CheckpointResult } from '@/seed/handover/handover-types';
import type { Day1ProbeOptions } from './types';
import { probeEdgeResponsiveness } from './edge-probe';
import { probeShaParity } from './sha-parity-probe';
import { probeD1CrudConsistency, probeR2Bindings } from './storage-probes';
import {
  probeAuthSessionReadiness,
  probeNowpaymentsReadiness,
  probeTelegramConnectivity,
} from './service-probes';
import {
  probeObservability,
  probeDrDrill,
  probeByokVaultEncryption,
  probeRunbooksCompleteness,
} from './security-ops-probes';

/**
 * Executes all 11 CEO Day-1 operational checkpoints sequentially or concurrently.
 */
export async function runAllDay1Probes(
  envOverride?: Record<string, unknown>,
  options?: Day1ProbeOptions,
  dbOverride?: D1Database,
): Promise<CheckpointResult[]> {
  const probes = [
    probeEdgeResponsiveness(options),
    probeShaParity(options),
    probeD1CrudConsistency(dbOverride),
    probeR2Bindings(envOverride),
    probeAuthSessionReadiness(),
    probeNowpaymentsReadiness(options),
    probeTelegramConnectivity(options),
    probeObservability(),
    probeDrDrill(envOverride, dbOverride),
    probeByokVaultEncryption(),
    Promise.resolve(probeRunbooksCompleteness()),
  ];

  const results = await Promise.allSettled(probes);
  return results.map((res, idx) => {
    if (res.status === 'fulfilled') {
      return res.value;
    }
    return {
      checkpointId: `checkpoint_${idx + 1}`,
      name: `Day-1 Checkpoint ${idx + 1}`,
      nameVi: `Điểm Kiểm Tra ${idx + 1}`,
      category: 'operations',
      status: 'FAIL',
      latencyMs: 0,
      details: `Probe unhandled exception: ${res.reason instanceof Error ? res.reason.message : String(res.reason)}`,
      error: res.reason instanceof Error ? res.reason.message : String(res.reason),
    };
  });
}
