/**
 * Server-side session helpers — drop-in replacement for old getCurrentUser().
 *
 * Usage in Server Components / Server Actions:
 *   import { getCurrentUser } from '@/lib/better-auth-session';
 *   const user = await getCurrentUser();
 */

import { getAuth } from './better-auth-server';
import type { User } from '@/lib/db/client';

/**
 * Get the full Better Auth session (user + session metadata).
 * Returns null if not authenticated.
 */
export async function getSession() {
  try {
    const { headers } = await import('next/headers');
    const auth = getAuth();
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch {
    return null;
  }
}

/**
 * Get current user — backward-compatible with old getCurrentUser() shape.
 * Returns { id, email, full_name, avatar_url, role } or null.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  const user = session.user as Record<string, unknown>;
  return {
    id: session.user.id,
    email: session.user.email,
    full_name: (session.user.name ?? undefined) as string | undefined,
    avatar_url: (session.user.image ?? undefined) as string | undefined,
    role: (user.role as string) ?? 'user',
  };
}

/**
 * Get current user from raw request headers (for API routes/middleware).
 * Does NOT use next/headers — pass headers explicitly.
 */
export async function getCurrentUserFromHeaders(
  reqHeaders: Headers,
): Promise<User | null> {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session) return null;

    const user = session.user as Record<string, unknown>;
    return {
      id: session.user.id,
      email: session.user.email,
      full_name: (session.user.name ?? undefined) as string | undefined,
      avatar_url: (session.user.image ?? undefined) as string | undefined,
      role: (user.role as string) ?? 'user',
    };
  } catch {
    return null;
  }
}
