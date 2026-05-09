import { getD1Client } from "@/seed/db/client";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { getUserTier } from "@/seed/db/get-user-tier";
import { AdminUsersClient, type AdminUserRow } from "./admin-users-client";
import { redirect } from "next/navigation";
import { logger } from "@/seed/utils/logger-utility";

export const dynamic = "force-dynamic";

/**
 * Admin Users Management page (server component).
 * Lists all users from D1 users table. Requires admin role.
 */
export default async function AdminUsersPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== 'admin') {
    redirect('/dashboard');
  }

  let users: AdminUserRow[] = [];
  try {
    const db = await getD1Client();
    const { data, error } = await db
      .from('users')
      .select('id, email, role, created_at, last_sign_in_at')
      .order('created_at', { ascending: false });

    if (error) logger.error("[admin/users] DB error", new Error(error.message));
    if (data) {
      const userRows = data as Record<string, string>[];
      // Reuse canonical getUserTier (active filter + org fallback) per user.
      // O(N) round-trips; acceptable for admin list (<1000 users typical).
      const tiers = await Promise.all(userRows.map((u) => getUserTier(u.id)));

      users = userRows.map((u, i) => ({
        id: u.id,
        email: u.email || "N/A",
        tier: tiers[i] ?? 'BASIC',
        status: u.last_sign_in_at ? "active" : "invited",
        createdAt: u.created_at,
      }));
    }
  } catch (e) {
    logger.error("[admin/users] Failed to fetch users", e instanceof Error ? e : new Error(String(e)));
  }

  return <AdminUsersClient initialUsers={users} />;
}
