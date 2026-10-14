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

export {
  MAX_ENDPOINTS_PER_TENANT,
  rowToEndpoint,
  markSuccess,
  markFailure,
  getActiveEndpointsForEvent,
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

export async function getById(
  db: D1Database,
  id: string,
  tenantId: string,
): Promise<WebhookEndpoint | null> {
  const row = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE id = ?1 AND tenant_id = ?2`)
    .bind(id, tenantId)
    .first<EndpointRow>();
  return row ? rowToEndpoint(row) : null;
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

export interface UpdateEndpointInput {
  active?: boolean;
  events?: WebhookEvent[];
  description?: string;
}

export async function update(
  db: D1Database,
  id: string,
  tenantId: string,
  patch: UpdateEndpointInput,
): Promise<WebhookEndpoint | null> {
  const existing = await getById(db, id, tenantId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const active = patch.active !== undefined ? (patch.active ? 1 : 0) : existing.active ? 1 : 0;
  const events = JSON.stringify(patch.events ?? existing.events);
  const description = patch.description !== undefined ? patch.description : (existing.description ?? null);

  await db
    .prepare(
      `UPDATE webhook_endpoints SET active = ?1, events = ?2, description = ?3, updated_at = ?4
       WHERE id = ?5 AND tenant_id = ?6`,
    )
    .bind(active, events, description, now, id, tenantId)
    .run();

  return getById(db, id, tenantId);
}

export async function remove(
  db: D1Database,
  id: string,
  tenantId: string,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM webhook_endpoints WHERE id = ?1 AND tenant_id = ?2`)
    .bind(id, tenantId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
