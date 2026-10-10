import type {
  WebhookEndpoint,
  WebhookEndpointRow,
  WebhookEndpointStatus,
} from '@/seed/types/outbound-webhooks';

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
