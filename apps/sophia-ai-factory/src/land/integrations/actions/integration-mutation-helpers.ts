/**
 * Helpers for CRM Configuration & Webhook Subscription Mutations
 *
 * Layer: land/integrations/actions
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { ActionResult } from './types';
import { assertAdminSession } from './admin-guard';

export type D1Binding = NonNullable<Awaited<ReturnType<typeof getD1>>>;

export async function requireAdminD1(): Promise<D1Binding> {
  await assertAdminSession();
  const db = await getD1();
  if (!db) throw new Error('Database connection unavailable');
  return db;
}

export function validateWebhookEndpointUrl(endpointUrl: string): void {
  if (!endpointUrl || !endpointUrl.startsWith('http')) {
    throw new Error('INVALID_URL: Webhook endpoint URL must start with http:// or https://');
  }
}

export async function runAdminD1Action<T>(
  handler: (db: D1Binding) => Promise<T>,
  errorLogLabel?: string,
): Promise<ActionResult<T>> {
  try {
    const db = await requireAdminD1();
    const data = await handler(db);
    return { success: true, data };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorLogLabel) {
      logger.error(errorLogLabel, err instanceof Error ? err : undefined, { errorMsg });
    }
    return { success: false, error: errorMsg };
  }
}
