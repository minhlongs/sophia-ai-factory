import { getBuildMetadata } from '@/seed/health/build-metadata';
import type { OpsSnapshotResponse } from './types';
import {
  fetchCronRuns,
  fetchActiveQueue,
  fetchFailedPermanent24h,
  fetchReconcile24h,
  fetchOutageNotifications,
} from './db-collectors';
import { fetchHeyGenHealth, fetchCircuitBreakerState } from './external-health';

export async function buildOpsSnapshot(db: D1Database): Promise<OpsSnapshotResponse> {
  const generatedAt = new Date().toISOString();
  const { sha, deployedAt } = getBuildMetadata();
  const opennextVersion = process.env.OPENNEXT_VERSION ?? 'unknown';

  const nowSec = Math.floor(Date.now() / 1000);
  const since24h = nowSec - 24 * 3600;

  const cronRuns = await fetchCronRuns(db);
  const activeQueue = await fetchActiveQueue(db);
  const failedPermanent24h = await fetchFailedPermanent24h(db, since24h);
  const reconcile24h = await fetchReconcile24h(db, since24h, failedPermanent24h.count);
  const heygenHealth = await fetchHeyGenHealth();
  const circuitBreaker = await fetchCircuitBreakerState();
  const outageNotifications = await fetchOutageNotifications(db, since24h);

  return {
    version: { sha, deployedAt, opennextVersion },
    cronRuns,
    activeQueue,
    failedPermanent24h,
    reconcile24h,
    heygenHealth,
    circuitBreaker,
    outageNotifications,
    generatedAt,
  };
}
