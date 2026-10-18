/**
 * Validated execution helpers for Multi-Cloud Edge Federation routing and failover actions.
 * @module land/multicloud/actions/multicloud-routing-helpers
 */

import { success, failure, type Result } from '@/seed/types/result';
import {
  resolveOptimalEdgeRoute,
  executeSub30msFailover,
} from '@/tree/multicloud/multicloud-router';
import { resolveZeroEgressAssetUrl } from '@/tree/multicloud/zero-egress-mesh';
import type {
  RouteRequestInput,
  RouteDecisionResult,
  TriggerFailoverInput,
  FailoverExecutionResult,
  ZeroEgressAssetRoutingInput,
  ZeroEgressRouteResult,
  MulticloudActionError,
} from './types';
import { requireAuth, getRequiredD1 } from './provider-health-checker';

export async function executeValidatedRouteTraffic(
  input: RouteRequestInput,
): Promise<Result<RouteDecisionResult, MulticloudActionError>> {
  const db = await getRequiredD1();
  if (!input.geographicZone || !input.workloadType) {
    return failure({ code: 'VALIDATION_ERROR', message: 'geographicZone and workloadType are required parameters.' });
  }
  return success(await resolveOptimalEdgeRoute(db, input));
}

export async function executeValidatedAutonomousFailover(
  input: TriggerFailoverInput,
): Promise<Result<FailoverExecutionResult, MulticloudActionError>> {
  await requireAuth();
  const db = await getRequiredD1();
  if (!input.originRegionId || !input.triggerReason) {
    return failure({ code: 'VALIDATION_ERROR', message: 'originRegionId and triggerReason are required.' });
  }
  return success(await executeSub30msFailover(db, input));
}

export async function executeValidatedZeroEgressAssetRoute(
  input: ZeroEgressAssetRoutingInput,
): Promise<Result<ZeroEgressRouteResult, MulticloudActionError>> {
  const db = await getRequiredD1();
  if (!input.assetKey) {
    return failure({ code: 'VALIDATION_ERROR', message: 'assetKey is required.' });
  }
  return success(await resolveZeroEgressAssetUrl(db, input));
}
