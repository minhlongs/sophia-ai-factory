/**
 * D1 CRUD for webhook_endpoints table.
 * All operations are tenant-scoped — no cross-tenant access.
 * @module lib/webhooks/registry-endpoints
 */

import type { WebhookEndpoint, WebhookEvent } from './types';
import type { EndpointRow } from './registry-row-types';
import {
  MAX_ENDPOINTS_PER_TENANT,
  rowToEndpoint,
  generateWebhookSecret,
  markSuccess,
  markFailure,
  getActiveEndpointsForEvent,
} from './registry-endpoint-status';
import {
  getById,
  update,
  remove,
  type UpdateEndpointInput,
} from './registry-endpoint-mutations';

export {
  MAX_ENDPOINTS_PER_TENANT,
  rowToEndpoint,
  markSuccess,
  markFailure,
  getActiveEndpointsForEvent,
  getById,
  update,
  remove,
  type UpdateEndpointInput,
};

export async function listByTenant(
  db: D1Database,
  tenantId: string,
): Promise<WebhookEndpoint[]> {
  const result = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE tenant_id = ?1 ORDER BY created_at DESC`)
    .bind(tenantId)
    .all<EndpointRow>();
  return (result.results ?? []).map((r) => rowToEndpoint(r));
}

export interface CreateEndpointInput {
  tenantId: string;
  url: string;
  events: WebhookEvent[];
  description?: string;
}

/** Create endpoint. Returns endpoint with secret (shown ONCE). */
export async function create(
  db: D1Database,
  input: CreateEndpointInput,
): Promise<WebhookEndpoint> {
  if (!input.url.startsWith('https://')) {
    throw new Error('Webhook URL must use HTTPS');
  }

  const countRow = await db
    .prepare(`SELECT COUNT(*) as cnt FROM webhook_endpoints WHERE tenant_id = ?1`)
    .bind(input.tenantId)
    .first<{ cnt: number }>();
  if ((countRow?.cnt ?? 0) >= MAX_ENDPOINTS_PER_TENANT) {
    throw new Error(`Max ${MAX_ENDPOINTS_PER_TENANT} webhook endpoints per tenant`);
  }

  const id = crypto.randomUUID();
  const secret = generateWebhookSecret();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO webhook_endpoints (id, tenant_id, url, secret, events, active, description, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?7)`,
    )
    .bind(id, input.tenantId, input.url, secret, JSON.stringify(input.events), input.description ?? null, now)
    .run();

  return {
    id,
    tenantId: input.tenantId,
    url: input.url,
    secret,
    events: input.events,
    active: true,
    description: input.description,
    createdAt: now,
    updatedAt: now,
    failureCount: 0,
  };
}
