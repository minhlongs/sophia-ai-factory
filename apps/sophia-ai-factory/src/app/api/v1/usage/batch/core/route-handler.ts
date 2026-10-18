import { NextRequest } from 'next/server';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { processBatchUsageRequest, handleBatchUsageOptions as helpersHandleOptions } from './batch-usage-helpers';

// Cap batch ingestion at 10 calls/minute per client (each call may carry up to
// 1000 events). Heaviest write surface in /v1; without this an attacker holding
// a leaked key can saturate D1 + quota counters.
export const handleBatchUsagePost = withRateLimit(
  processBatchUsageRequest,
  { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 10 } },
);

export async function handleBatchUsageOptions(request: NextRequest) {
  return helpersHandleOptions(request);
}