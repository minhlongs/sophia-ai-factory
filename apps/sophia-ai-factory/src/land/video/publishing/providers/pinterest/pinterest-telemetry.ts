/**
 * Pinterest API Status Polling & Analytics Telemetry
 *
 * @module land/video/publishing/providers/pinterest/pinterest-telemetry
 */

import type { PublishStatus, MetricsJson } from '../publisher-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { PinStatsResponse } from './types';

export const PINTEREST_API = 'https://api.pinterest.com/v5';
export const MAX_DESCRIPTION_LEN = 500;

export function isMockMode(): boolean {
  return !process.env.PINTEREST_CLIENT_ID;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function checkPinStatus(accessToken: string, externalPostId: string): Promise<PublishStatus> {
  if (!shouldAllowRequest('pinterest')) return 'processing';

  try {
    const res = await fetch(`${PINTEREST_API}/pins/${encodeURIComponent(externalPostId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 404) return 'failed';
    if (!res.ok) return 'processing';
    recordSuccess('pinterest');
    return 'live';
  } catch (error) {
    recordFailure('pinterest', classifyError(error));
    return 'processing';
  }
}

export async function fetchPinMetrics(accessToken: string, externalPostId: string): Promise<MetricsJson> {
  if (!shouldAllowRequest('pinterest')) {
    return { views: 0, likes: 0 };
  }

  try {
    const today = todayIso();
    const res = await fetch(
      `${PINTEREST_API}/pins/${encodeURIComponent(externalPostId)}/analytics?start_date=${today}&end_date=${today}&metric_types=IMPRESSION,SAVE,OUTBOUND_CLICK,PIN_CLICK`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) return { views: 0, likes: 0 };

    const data = (await res.json()) as { all?: { daily_metrics?: PinStatsResponse[] } };
    const daily = data.all?.daily_metrics?.[0] ?? {};
    recordSuccess('pinterest');
    return {
      views: daily.impression ?? 0,
      likes: daily.pin_click ?? 0,
      shares: daily.save ?? 0,
      reach: daily.outbound_click ?? 0,
    };
  } catch (error) {
    recordFailure('pinterest', classifyError(error));
    return { views: 0, likes: 0 };
  }
}
