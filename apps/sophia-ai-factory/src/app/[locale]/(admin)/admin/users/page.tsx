import { createServerClient } from "@/lib/db/client";
import { AdminUsersClient, type AdminUserRow } from "./admin-users-client";

export const dynamic = "force-dynamic";

/**
 * Admin Users Management page (server component).
 * Lists all users from D1 users table.
 */
export default async function AdminUsersPage() {
  let users: AdminUserRow[] = [];
  try {
    const db = createServerClient();
    const { data } = await db
      .from('users')
      .select('id, email, role, created_at, last_sign_in_at')
      .order('created_at', { ascending: false });

    if (data) {
      users = (data as Record<string, string>[]).map((u) => ({
        id: u.id,
        email: u.email || "N/A",
        tier: "BASIC",
        status: u.last_sign_in_at ? "active" : "invited",
        createdAt: u.created_at,
      }));
    }
  } catch {
    // D1 users table may not exist yet
  }

  return <AdminUsersClient initialUsers={users} />;
}
