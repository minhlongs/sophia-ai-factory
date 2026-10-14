/**
 * @module tree/compute/scheduler/tick-coordinator
 * Clock drift validation and dispatch hash coordination.
 */

import { createHash } from 'node:crypto';
import type { DispatchPlanConfig, DispatchPlanContext } from './types';

/**
 * Filters meshes for stability according to configuration.
 */
export function filterStableMeshes<T>(
  meshes: T[],
  config: DispatchPlanConfig<T>,
): T[] {
  if (config.allMeshesStable) {
    return meshes;
  }

  const stableStatus = config.stableStatus ?? 'ANYONIC_FLUX_STABLE';
  const getStatus =
    config.statusGetter ??
    ((m: T) => {
      const item = m as Record<string, unknown>;
      return (
        item.vacuumMatrixStatus ??
        item.meshStatus ??
        item.status ??
        item.foamLatticeStatus ??
        item.superLatticeStatus ??
        item.topologicalStatus ??
        item.superconductingStatus
      ) as string;
    });

  return meshes.filter((m) => getStatus(m) === stableStatus);
}

/**
 * Validates measured Planck relativistic clock drift against threshold.
 */
export function validateClockDrift<T>(
  measuredDriftFs: number,
  config: DispatchPlanConfig<T>,
): void {
  if (
    !config.skipDriftCheck &&
    config.maxClockDriftFs !== undefined &&
    measuredDriftFs > config.maxClockDriftFs
  ) {
    throw new Error(
      config.clockDriftErrorMessageFn
        ? config.clockDriftErrorMessageFn(measuredDriftFs, config.maxClockDriftFs)
        : `Planck relativistic clock drift ${measuredDriftFs} exceeds allowable threshold ${config.maxClockDriftFs}`,
    );
  }
}

/**
 * Computes deterministic dispatch verification hash.
 */
export function computeDispatchHash<T>(
  planContext: DispatchPlanContext,
  config: DispatchPlanConfig<T>,
): string {
  if (config.dispatchHashFn) {
    return config.dispatchHashFn(planContext);
  }
  const prefix = config.hashPrefix ?? 'DISPATCH';
  return createHash('sha256')
    .update(
      `${prefix}:${planContext.targetMeshRef}:${planContext.assignedWorkloads}:${planContext.totalBandwidthPetabytes}:${planContext.measuredDriftFs}`,
    )
    .digest('hex');
}
