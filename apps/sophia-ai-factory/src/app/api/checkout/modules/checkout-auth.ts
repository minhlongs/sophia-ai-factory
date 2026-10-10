import { getCurrentUserFromHeaders, AuthSystemError } from '@/seed/auth/better-auth-session';

/**
 * Extract user ID from Better Auth session headers.
 * Returns null if not authenticated.
 */
export async function getUserId(request: Request): Promise<string | null> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (user?.id) return user.id;
  } catch (err) {
    if (err instanceof AuthSystemError) throw err;
  }
  return null;
}
