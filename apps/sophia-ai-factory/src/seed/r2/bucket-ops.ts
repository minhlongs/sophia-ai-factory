/**
 * R2 Bucket Operations — common helpers for writing objects to R2
 *
 * Uses the BACKUPS_BUCKET binding (sophia-backups) which is configured
 * in wrangler.toml and available in production Cloudflare Workers.
 * Returns null when binding is unavailable (build-time, tests, local dev).
 */

import type { R2Bucket } from '@cloudflare/workers-types';

interface Env {
  BACKUPS_BUCKET?: R2Bucket;
}

/**
 * Get the BACKUPS_BUCKET binding from Cloudflare runtime context.
 * Returns null if not available (non-CF context, build, test).
 */
function getBackupsBucket(): R2Bucket | null {
  try {
    // Primary: globalThis.__env__ (OpenNext Cloudflare worker)
    const envDouble = (globalThis as unknown as Record<string, Env>).__env__;
    if (envDouble?.BACKUPS_BUCKET) return envDouble.BACKUPS_BUCKET;

    // Fallback: legacy single underscore
    const env = (globalThis as unknown as Record<string, Env>).__env;
    if (env?.BACKUPS_BUCKET) return env.BACKUPS_BUCKET;

    // Fallback: Cloudflare context symbol
    const ctx = (globalThis as Record<symbol, { env?: Env }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.BACKUPS_BUCKET) return ctx.env.BACKUPS_BUCKET;

    return null;
  } catch {
    return null;
  }
}

/**
 * Write a JSON object to the BACKUPS_BUCKET (sophia-backups).
 *
 * @param key - Object key (e.g., 'webhook-dead-letter/telegram/2026-08-10T12-00-00.000Z-event123.json')
 * @param payload - JSON-serializable object to write
 * @returns true if written, false if bucket unavailable or write failed
 */
export async function writeDeadLetterToR2(
  key: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const bucket = getBackupsBucket();
  if (!bucket) {
    return false;
  }

  try {
    const body = JSON.stringify(payload, null, 2);
    await bucket.put(key, body, {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: {
        writtenAt: new Date().toISOString(),
        source: 'webhook-dead-letter',
      },
    });
    return true;
  } catch {
    // Non-fatal: log error but don't throw — caller handles 503 response
    return false;
  }
}

/**
 * Generate a dead-letter object key for a webhook type.
 * Pattern: webhook-dead-letter/<webhook-type>/<ISO-timestamp>-<eventId>.json
 */
export function generateDeadLetterKey(
  webhookType: 'telegram' | 'nowpayments' | 'nowpayments-ipn',
  eventId: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return `webhook-dead-letter/${webhookType}/${timestamp}-${safeEventId}.json`;
}