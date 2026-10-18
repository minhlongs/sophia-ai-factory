/**
 * D1 update and delete mutations for webhook_endpoints table.
 * @module lib/webhooks/registry-endpoint-mutations
 */

import type { WebhookEndpoint, WebhookEvent } from './types';
import type { EndpointRow } from './registry-row-types';
import { rowToEndpoint } from './registry-endpoint-status';

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
