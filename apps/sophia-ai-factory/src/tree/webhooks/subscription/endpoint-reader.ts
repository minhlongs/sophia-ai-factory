import type { D1Database } from '@/seed/db/client';
import type {
  WebhookEndpoint,
  WebhookEndpointRow,
  ListWebhookEndpointsOptions,
} from '@/seed/types/outbound-webhooks';
import { assertOrgScope, isEventSubscribed } from './validation';
import { parseWebhookEndpointRow } from './row-parser';

/**
 * Retrieves a webhook endpoint by ID.
 * If expectedOrgId is provided, enforces tenant isolation.
 */
export async function getWebhookEndpointById(
  db: D1Database,
  endpointId: string,
  expectedOrgId?: string
): Promise<WebhookEndpoint | null> {
  const row = await db
    .prepare(`SELECT * FROM webhook_endpoints WHERE id = ?1 LIMIT 1`)
    .bind(endpointId)
    .first<WebhookEndpointRow>();

  if (!row) {
    return null;
  }

  if (expectedOrgId) {
    assertOrgScope(expectedOrgId, row.org_id);
  }

  return parseWebhookEndpointRow(row);
}

/**
 * Lists all webhook endpoints for an organization with optional status filtering.
 */
export async function listWebhookEndpointsByOrg(
  db: D1Database,
  orgId: string,
  options?: ListWebhookEndpointsOptions
): Promise<WebhookEndpoint[]> {
  const cleanOrgId = (orgId || '').trim();
  if (!cleanOrgId) {
    throw new Error('CROSS_TENANT_VIOLATION: Organization ID is required');
  }

  const limit = options?.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
  const offset = options?.offset && options.offset >= 0 ? options.offset : 0;

  let query = `SELECT * FROM webhook_endpoints WHERE org_id = ?1`;
  const binds: (string | number)[] = [cleanOrgId];

  if (options?.status) {
    query += ` AND status = ?2`;
    binds.push(options.status);
    query += ` ORDER BY created_at DESC LIMIT ?3 OFFSET ?4`;
    binds.push(limit, offset);
  } else {
    query += ` ORDER BY created_at DESC LIMIT ?2 OFFSET ?3`;
    binds.push(limit, offset);
  }

  const result = await db.prepare(query).bind(...binds).all<WebhookEndpointRow>();
  const rows = result.results ?? [];
  return rows.map(parseWebhookEndpointRow);
}

/**
 * Discovers active webhook endpoints subscribed to a specific event within an organization.
 */
export async function findMatchingEndpointsForEvent(
  db: D1Database,
  orgId: string,
  event: string
): Promise<WebhookEndpoint[]> {
  const cleanOrgId = (orgId || '').trim();
  if (!cleanOrgId) return [];

  const activeEndpoints = await listWebhookEndpointsByOrg(db, cleanOrgId, { status: 'active' });
  return activeEndpoints.filter((ep) => isEventSubscribed(ep.events, event));
}
