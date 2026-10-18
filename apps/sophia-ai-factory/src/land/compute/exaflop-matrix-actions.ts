'use server';

/**
 * @file exaflop-matrix-actions.ts
 * @layer land/compute
 * @description Land layer Server Actions for ExaFLOP Compute Matrix dispatch and Eight-Nines SLA tracking.
 */

import {
  planPlanetaryWorkloadDispatch,
  evaluateEightNinesSla,
} from '@/tree/compute/exaflop-matrix-engine';
import { routeOrbitalTransmission } from '@/tree/orbital/deep-space-relay-engine';
import type {
  ExaflopComputeCluster,
  PlanetaryDispatchPlan,
  EightNinesSlaRecord,
  OrbitalRelayNode,
  OpticalTransmissionRequest,
  OpticalTransmissionResult,
} from '@/seed/types/exaflop-matrix';
import {
  persistPlanetaryBatch,
  persistEightNinesSlaRecord,
} from './exaflop-matrix-persistence';

export interface DispatchPlanetaryActionParams {
  batchUuid: string;
  totalWorkloads: number;
  clusters: ExaflopComputeCluster[];
}

export interface DispatchPlanetaryActionResult {
  success: boolean;
  plan?: PlanetaryDispatchPlan;
  error?: string;
}

export async function dispatchPlanetaryWorkloadAction(
  params: DispatchPlanetaryActionParams
): Promise<DispatchPlanetaryActionResult> {
  try {
    const plan = planPlanetaryWorkloadDispatch(params.totalWorkloads, params.clusters);
    await persistPlanetaryBatch(params.batchUuid, params.totalWorkloads, plan);
    return { success: true, plan };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export interface RecordEightNinesSlaActionParams {
  periodIdentifier: string;
  downtimeMs: number;
}

export interface RecordEightNinesSlaActionResult {
  success: boolean;
  record?: EightNinesSlaRecord;
  error?: string;
}

export async function recordEightNinesSlaAction(
  params: RecordEightNinesSlaActionParams
): Promise<RecordEightNinesSlaActionResult> {
  try {
    const record = evaluateEightNinesSla(params.periodIdentifier, params.downtimeMs);
    await persistEightNinesSlaRecord(record);
    return { success: true, record };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

export interface RouteOrbitalLaserActionParams {
  node: OrbitalRelayNode;
  request: OpticalTransmissionRequest;
}

export interface RouteOrbitalLaserActionResult {
  success: boolean;
  result?: OpticalTransmissionResult;
  error?: string;
}

export async function routeOrbitalLaserAction(
  params: RouteOrbitalLaserActionParams
): Promise<RouteOrbitalLaserActionResult> {
  try {
    const result = routeOrbitalTransmission(params.node, params.request);
    return { success: true, result };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
