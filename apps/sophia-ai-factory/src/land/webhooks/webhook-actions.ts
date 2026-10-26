'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import {
  listByTenant,
  create,
  remove,
  update,
} from './registry-endpoints';
import type { WebhookEvent } from './types';
import type { WebhookEndpointItem } from '@/components/stitch/screens/webhook/webhook-cards';

export async function listUserWebhookEndpoints(): Promise<WebhookEndpointItem[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const db = await getD1();
    if (!db) return [];

    const rows = await listByTenant(db, user.id);
    return rows.map((r) => ({
      id: r.id,
      name: r.description || 'Webhook Endpoint',
      url: r.url,
      events: r.events,
      secret: r.secret || 'whsec_••••••••••••',
      active: r.active,
    }));
  } catch {
    return [];
  }
}

export async function createUserWebhookEndpoint(input: {
  name: string;
  url: string;
  events: string[];
}): Promise<{ success: boolean; endpoint?: WebhookEndpointItem; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database binding unavailable' };
    }

    const created = await create(db, {
      tenantId: user.id,
      url: input.url.trim(),
      events: input.events as WebhookEvent[],
      description: input.name.trim() || 'Webhook Endpoint',
    });

    return {
      success: true,
      endpoint: {
        id: created.id,
        name: created.description || 'Webhook Endpoint',
        url: created.url,
        events: created.events,
        secret: created.secret || 'whsec_••••••••••••',
        active: created.active,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create webhook',
    };
  }
}

export async function deleteUserWebhookEndpoint(
  endpointId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const db = await getD1();
    if (!db) return { success: false, error: 'Database binding unavailable' };

    const removed = await remove(db, endpointId, user.id);
    return { success: removed };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete webhook',
    };
  }
}

export async function toggleUserWebhookEndpoint(
  endpointId: string,
  active: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const db = await getD1();
    if (!db) return { success: false, error: 'Database binding unavailable' };

    const updated = await update(db, endpointId, user.id, { active });
    return { success: Boolean(updated) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update webhook',
    };
  }
}
