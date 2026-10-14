/**
 * Delivery status tracking and event subscription query helpers for land webhook endpoints.
 * @module land/webhooks/registry-endpoint-status
 */

import type { WebhookEndpoint, WebhookEvent } from './types';
import type { EndpointRow } from './registry-row-types';

export const MAX_ENDPOINTS_PER_TENANT = 50;

export function rowToEndpoint(row: EndpointRow, includeSecret = false): WebhookEndpoint {
  const ep: WebhookEndpoint = {
    id: row.id,
    tenantId: row.tenant_id,
    url: row.url,
    events: JSON.parse(row.events) as WebhookEvent[],
    active: row.active === 1,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSuccessAt: row.last_success_at ?? undefined,
    lastFailureAt: row.last_failure_at ?? undefined,
    failureCount: row.failure_count,
  };
  if (includeSecret) ep.secret = row.secret;
  return ep;
}

/** Generate a 32-byte hex secret using Web Crypto */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function markSuccess(db: D1Database, endpointId: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE webhook_endpoints SET last_success_at = ?1, failure_count = 0, updated_at = ?1
       WHERE id = ?2`,
    )
    .bind(now, endpointId)
    .run();
}

export async function markFailure(db: D1Database, endpointId: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE webhook_endpoints
       SET last_failure_at = ?1, failure_count = failure_count + 1, updated_at = ?1
       WHERE id = ?2`,
    )
    .bind(now, endpointId)
    .run();
}

/** Load active endpoints subscribed to a specific event for a tenant. */
export async function getActiveEndpointsForEvent(
  db: D1Database,
  tenantId: string,
  event: WebhookEvent,
): Promise<(WebhookEndpoint & { secret: string })[]> {
  const result = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE tenant_id = ?1 AND active = 1`)
    .bind(tenantId)
    .all<EndpointRow>();

  return (result.results ?? [])
    .filter((row) => {
      try {
        return (JSON.parse(row.events) as string[]).includes(event);
      } catch {
        return false;
      }
    })
    .map((r) => rowToEndpoint(r, true) as WebhookEndpoint & { secret: string });
}
