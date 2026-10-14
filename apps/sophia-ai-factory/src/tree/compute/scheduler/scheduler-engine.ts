/**
 * @module tree/compute/scheduler/scheduler-engine
 * Canonical parameterized scheduler engine for batch dispatch planning.
 */

import type {
  DispatchPlanConfig,
  DispatchPlanContext,
  ParameterizedDispatchPlan,
} from './types';
import { selectOptimalMesh } from './priority-queue';
import {
  filterStableMeshes,
  validateClockDrift,
  computeDispatchHash,
} from './tick-coordinator';

/**
 * Plans dispatch of cognitive workloads to optimal compute mesh.
 */
export function planParameterizedBatchDispatch<T = unknown>(
  meshes: T[],
  workloads: number,
  measuredDriftFs: number,
  config: DispatchPlanConfig<T>,
): ParameterizedDispatchPlan {
  const stableMeshes = filterStableMeshes(meshes, config);

  if (stableMeshes.length === 0) {
    throw new Error(
      config.zeroStableMeshesErrorMessage ??
        'Zero stable compute meshes available for dispatch',
    );
  }

  validateClockDrift(measuredDriftFs, config);

  const { bestRef, highestScore } = selectOptimalMesh(stableMeshes, config);

  const assignedWorkloads =
    config.assignedWorkloads !== undefined ? config.assignedWorkloads : workloads;
  const bwFactor = config.bandwidthPerWorkloadPb ?? 0.0025;
  const totalBandwidthPetabytes =
    config.totalBandwidthPetabytes !== undefined
      ? config.totalBandwidthPetabytes
      : Number((workloads * bwFactor).toFixed(2));

  const planContext: DispatchPlanContext = {
    targetMeshRef: bestRef,
    assignedWorkloads,
    totalBandwidthPetabytes,
    measuredDriftFs,
    highestScore,
  };

  const dispatchHash = computeDispatchHash(planContext, config);

  return {
    targetMatrixRef: bestRef,
    targetMeshRef: bestRef,
    targetLatticeRef: bestRef,
    targetGridId: bestRef,
    targetMatrixId: bestRef,
    assignedWorkloads,
    totalBandwidthPetabytes,
    totalOpticalPetabytes: totalBandwidthPetabytes,
    planckDriftFs: measuredDriftFs,
    measuredDriftFs,
    measuredDriftPs: measuredDriftFs,
    relativisticDriftFs: measuredDriftFs,
    relativisticDriftPs: measuredDriftFs,
    tachyonDriftFs: measuredDriftFs,
    quantumDriftFs: measuredDriftFs,
    femtosecondDriftFs: measuredDriftFs,
    dispatchHash,
  };
}
