/**
 * D1 database accessor for Cloudflare Worker context — delegates to canonical client.
 * @module app/api/cron/email-drip/get-d1
 */

import { getD1Sync } from '@/seed/db/client';

export function getD1(): D1Database | null {
  try {
    return getD1Sync();
  } catch {
    return null;
  }
}
