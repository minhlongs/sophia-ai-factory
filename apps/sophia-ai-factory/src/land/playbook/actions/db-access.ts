/**
 * Database client resolution helper for Playbook Server Actions.
 *
 * Layer: land (business workflows / Server Actions)
 *
 * @module land/playbook/actions/db-access
 */

import { getD1, createServerClient, type D1Client, type D1Database } from '@/seed/db/client';

export async function getDbAccess(): Promise<{ d1: D1Database | null; client: D1Client | null }> {
  let d1: D1Database | null = null;
  try {
    d1 = await getD1();
  } catch {
    d1 = null;
  }

  let client: D1Client | null = null;
  try {
    client = createServerClient();
  } catch {
    client = null;
  }

  return { d1, client };
}
