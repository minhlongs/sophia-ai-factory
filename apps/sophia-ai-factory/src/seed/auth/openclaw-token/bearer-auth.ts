import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { User } from '@/seed/db/client';
import { verifyOpenclawToken } from './token-verifier';

export function extractBearer(headers: Headers): string | null {
  const raw = headers.get('authorization');
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolve the calling user from EITHER:
 *   1. `Authorization: Bearer <exchange_token>` (v2 with JTI, preferred)
 *   2. Better Auth session cookie
 *
 * Returns null if neither path produces a valid user.
 */
export async function getCurrentUserOrOpenclawBearer(headers: Headers): Promise<User | null> {
  const bearer = extractBearer(headers);
  if (bearer) {
    const verified = await verifyOpenclawToken(bearer);
    if (verified) {
      try {
        const db = await getD1();
        if (!db) throw new Error('D1 database binding not available');
        const row = await db
          .prepare(
            'SELECT id, email, name, role, "emailVerified" AS email_verified FROM user WHERE id = ?1 LIMIT 1',
          )
          .bind(verified.userId)
          .first<{
            id: string;
            email: string;
            name: string | null;
            role: string | null;
            email_verified: number | null;
          }>();
        if (row) {
          return {
            id: row.id,
            email: row.email,
            name: row.name ?? null,
            role: row.role ?? null,
            emailVerified: Boolean(row.email_verified),
          } as unknown as User;
        }
      } catch (err) {
        logger.error('[openclaw-token] D1 user lookup failed', toError(err), {
          userId: verified.userId,
        });
      }
    }
    // Bearer present but invalid — fall through to cookie auth.
  }

  return getCurrentUserFromHeaders(headers);
}
