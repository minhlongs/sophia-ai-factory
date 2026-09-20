/**
 * Outbound Webhook Subscription Repository & Event Matching Engine
 *
 * Implements CRUD operations for webhook endpoint subscriptions, strict HTTPS validation,
 * tenant scoping, and event wildcard matching.
 *
 * Layer: tree/webhooks (Domain logic - imports only from @/seed/*)
 * Strictly follows 4-layer architecture rules (0 imports from @/forest or @/land).
 *
 * @module tree/webhooks/subscription-repo
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  WebhookEndpoint,
  WebhookEndpointRow,
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  ListWebhookEndpointsOptions,
  WebhookEndpointStatus,
} from '@/seed/types/outbound-webhooks';

/**
 * Validates that a webhook URL is present and strictly uses the HTTPS protocol.
 * Throws an Error with 'INVALID_WEBHOOK_URL' code if validation fails.
 */
export function validateWebhookUrl(url: string | null | undefined): void {
  if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol');
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error('INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol');
    }
  } catch {
    throw new Error('INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol');
  }
}

/**
 * Evaluates whether an event name matches any of the subscribed event patterns.
 * Supports:
 * - Exact matching: 'video.rendered' === 'video.rendered'
 * - Global wildcard: '*' matches any event
 * - Namespace wildcard: 'video.*' matches 'video.rendered', 'video.failed', etc.
 */
export function isEventSubscribed(subscribedEvents: string[], event: string): boolean {
  if (!Array.isArray(subscribedEvents) || subscribedEvents.length === 0) {
    return false;
  }

  if (subscribedEvents.includes('*')) {
    return true;
  }

  if (subscribedEvents.includes(event)) {
    return true;
  }

  return subscribedEvents.some((pattern) => {
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1); // e.g. "video."
      return event.startsWith(prefix);
    }
    return false;
  });
}

/**
 * Parses raw D1 database row into domain WebhookEndpoint model.
 */
export function parseWebhookEndpointRow(row: WebhookEndpointRow): WebhookEndpoint {
  let parsedEvents: string[] = [];
  try {
    parsedEvents = typeof row.events === 'string' ? JSON.parse(row.events) : row.events;
  } catch {
    parsedEvents = [];
  }

  return {
    id: row.id,
    org_id: row.org_id,
    url: row.url,
    secret: row.secret,
    description: row.description ?? '',
    events: Array.isArray(parsedEvents) ? parsedEvents : [],
    status: (row.status === 'disabled' ? 'disabled' : 'active') as WebhookEndpointStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Generates an endpoint ID conforming to the 'wep_' prefix format.
 */
function generateEndpointId(): string {
  const rand = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
  return `wep_${rand}`;
}

/**
 * Generates a high-entropy webhook signing secret conforming to 'whsec_'.
 */
function generateEndpointSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `whsec_${hex}`;
}

/**
 * Asserts tenant matching for operations on existing records.
 * Throws an error matching /CROSS_TENANT_VIOLATION/ without importing from forest layer.
 */
function assertOrgScope(expectedOrgId: string, actualOrgId: string): void {
  const expected = (expectedOrgId || '').trim();
  const actual = (actualOrgId || '').trim();

  if (!expected || !actual || expected !== actual) {
    throw new Error(
      `CROSS_TENANT_VIOLATION: Current org context '${expected || '<EMPTY>'}' is not authorized to access resource in org '${actual || '<EMPTY>'}'`
    );
  }
}

/**
 * Creates a new webhook endpoint subscription for an organization.
 */
export async function createWebhookEndpoint(
  db: D1Database,
  orgId: string,
  input: CreateWebhookEndpointInput
): Promise<WebhookEndpoint> {
  const cleanOrgId = (orgId || '').trim();
  if (!cleanOrgId) {
    throw new Error('CROSS_TENANT_VIOLATION: Organization ID is required');
  }

  validateWebhookUrl(input.url);

  if (!Array.isArray(input.events) || input.events.length === 0) {
    throw new Error('VALIDATION_ERROR: At least one event subscription is required');
  }

  const id = generateEndpointId();
  const secret = input.secret && input.secret.trim() ? input.secret.trim() : generateEndpointSecret();
  const description = input.description?.trim() ?? '';
  const eventsJson = JSON.stringify(input.events);
  const now = Date.now();

  try {
    await db
      .prepare(
        `INSERT INTO webhook_endpoints 
         (id, org_id, url, secret, description, events, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?8)`
      )
      .bind(id, cleanOrgId, input.url.trim(), secret, description, eventsJson, now, now)
      .run();

    logger.info('[webhooks] endpoint created', { endpointId: id, orgId: cleanOrgId });

    return {
      id,
      org_id: cleanOrgId,
      url: input.url.trim(),
      secret,
      description,
      events: input.events,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
  } catch (err) {
    logger.error('[webhooks] create endpoint failed', {
      orgId: cleanOrgId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

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
 * Updates an existing webhook endpoint with tenant isolation check.
 */
export async function updateWebhookEndpoint(
  db: D1Database,
  orgId: string,
  endpointId: string,
  input: UpdateWebhookEndpointInput
): Promise<WebhookEndpoint> {
  const existing = await getWebhookEndpointById(db, endpointId, orgId);
  if (!existing) {
    throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${endpointId}' not found`);
  }

  if (input.url !== undefined) {
    validateWebhookUrl(input.url);
  }

  const newUrl = input.url !== undefined ? input.url.trim() : existing.url;
  const newSecret = input.secret !== undefined ? input.secret.trim() : existing.secret;
  const newDescription = input.description !== undefined ? input.description.trim() : existing.description;
  const newEvents = input.events !== undefined ? input.events : existing.events;
  const newStatus = input.status !== undefined ? input.status : existing.status;
  const now = Date.now();

  await db
    .prepare(
      `UPDATE webhook_endpoints
       SET url = ?1, secret = ?2, description = ?3, events = ?4, status = ?5, updated_at = ?6
       WHERE id = ?7 AND org_id = ?8`
    )
    .bind(
      newUrl,
      newSecret,
      newDescription,
      JSON.stringify(newEvents),
      newStatus,
      now,
      endpointId,
      orgId
    )
    .run();

  return {
    ...existing,
    url: newUrl,
    secret: newSecret,
    description: newDescription,
    events: newEvents,
    status: newStatus,
    updated_at: now,
  };
}

/**
 * Deletes a webhook endpoint with tenant isolation verification.
 */
export async function deleteWebhookEndpoint(
  db: D1Database,
  orgId: string,
  endpointId: string
): Promise<boolean> {
  const existing = await getWebhookEndpointById(db, endpointId, orgId);
  if (!existing) {
    throw new Error(`ENDPOINT_NOT_FOUND: Endpoint '${endpointId}' not found`);
  }

  await db
    .prepare(`DELETE FROM webhook_endpoints WHERE id = ?1 AND org_id = ?2`)
    .bind(endpointId, orgId)
    .run();

  logger.info('[webhooks] endpoint deleted', { endpointId, orgId });
  return true;
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
