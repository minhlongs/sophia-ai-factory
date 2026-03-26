/**
 * RaaS Auth Context — Extract userId + orgId from JWT cookie.
 * Shared helper for all /api/raas/* endpoints.
 */

import { cookies } from 'next/headers';

export interface AuthContext {
  userId: string;
  orgId: string;
}

/** Returns auth context from JWT cookie, or null if unauthenticated */
export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;

  try {
    const { verifyJwt } = await import('@/lib/db/auth-verify');
    const payload = await verifyJwt(token);
    if (!payload?.sub) return null;

    const { getUserOrganization } = await import('@/lib/db/auth');
    const org = await getUserOrganization(payload.sub as string);
    if (!org) return null;

    return { userId: payload.sub as string, orgId: org.id };
  } catch {
    return null;
  }
}
