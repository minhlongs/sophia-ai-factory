import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { UserRow } from './types';

/**
 * Fetch basic user email and locale info.
 */
export async function fetchUserInfo(userId: string): Promise<{ email: string; locale: string } | null> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('user')
      .select('email, locale')
      .eq('id', userId)
      .single();
    const row = data as UserRow | null;
    if (!row?.email) return null;
    return { email: row.email, locale: row.locale ?? 'vi' };
  } catch (err) {
    logger.error('[WebhookComplete] fetchUserInfo failed', err instanceof Error ? err : undefined, { userId });
    return null;
  }
}
