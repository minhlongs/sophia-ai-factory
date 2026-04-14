import { getD1Client } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/better-auth-session";
import { AdminUsersClient, type AdminUserRow } from "./admin-users-client";
import { redirect } from "next/navigation";

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

    if (error) console.error("[admin/users] DB error:", error.message);
    if (data) {
      users = (data as Record<string, string>[]).map((u) => ({
        id: u.id,
        email: u.email || "N/A",
        tier: "BASIC",
        status: u.last_sign_in_at ? "active" : "invited",
        createdAt: u.created_at,
      }));
    }
  } catch (e) {
    console.error("[admin/users] Failed to fetch users:", (e as Error).message);
  }

  return <AdminUsersClient initialUsers={users} />;
}
