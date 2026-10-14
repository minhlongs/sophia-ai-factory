/**
 * Raw Sub-ID and Order ID Extractors
 *
 * Layer: tree/affiliate
 */

import { SUB_ID_KEYS } from './types';

export function extractRawSubIdFromPayload(payload: Record<string, unknown>): string | null {
  for (const key of SUB_ID_KEYS) {
    const val = payload[key];
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

export function extractSubIdFromQueryParams(
  queryParams: Record<string, string> | URLSearchParams,
): string | null {
  const q =
    queryParams instanceof URLSearchParams
      ? Object.fromEntries(queryParams.entries())
      : queryParams;
  for (const key of SUB_ID_KEYS) {
    if (q[key]) return q[key];
  }
  return null;
}

export function extractOrderId(payload: Record<string, unknown>): string | null {
  return (
    (payload.conversionId as string) ||
    (payload.order_id as string) ||
    (payload.orderId as string) ||
    (payload.receipt as string) ||
    (payload.id ? String(payload.id) : null)
  );
}
