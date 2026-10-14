import { getD1 } from '@/seed/db/client';
import { consumeMagicLink } from '@/tree/handover/handover-magic-link';
import { writeAuditLog } from '@/tree/admin/audit-log';
import { hashEmail } from '@/seed/auth/sign-cookie-value';
import { logger } from '@/seed/utils/logger-utility';
import { ALLOWED_LOCALES, type AllowedLocale, type UserRow } from './types';

export function safeLocale(raw: unknown): AllowedLocale {
  if (typeof raw === 'string' && (ALLOWED_LOCALES as readonly string[]).includes(raw)) {
    return raw as AllowedLocale;
  }
  return 'en';
}

export function parseInstalledSops(starterSops: string | null | undefined): string[] {
  if (!starterSops) return [];
  try {
    return JSON.parse(starterSops) as string[];
  } catch {
    return [];
  }
}

export async function fetchHandoverUser(userId: string): Promise<UserRow | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  return db
    .prepare('SELECT email, name FROM user WHERE id = ?1 LIMIT 1')
    .bind(userId)
    .first<UserRow>();
}

export async function consumeAndAuditHandover(
  handover: { id: string; customer_user_id: string; source?: string },
  token: string,
): Promise<boolean> {
  const consumed = await consumeMagicLink(handover.id, token);
  if (!consumed) return false;

  let emailHash: string | null = null;
  try {
    const user = await fetchHandoverUser(handover.customer_user_id);
    if (user?.email) emailHash = await hashEmail(user.email);
  } catch { /* non-fatal */ }

  await writeAuditLog({
    actorUserId: handover.customer_user_id,
    actionType: 'customer_handover_consumed',
    targetUserId: handover.customer_user_id,
    payload: { handoverId: handover.id, emailHash, source: handover.source },
  });
  logger.info('[Welcome/Consume] Magic link consumed', { handoverId: handover.id });
  return true;
}
