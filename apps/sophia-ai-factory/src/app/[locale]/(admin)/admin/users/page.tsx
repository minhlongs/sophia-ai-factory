import { createServerClient } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/db/auth";
import { AdminUsersClient, type AdminUserRow } from "./admin-users-client";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * Admin Users Management page (server component).
 * Lists all users from D1 users table. Requires admin role.
 */
export default async function AdminUsersPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const currentUser = await getCurrentUser(cookieHeader);

  if (!currentUser || currentUser.role !== 'admin') {
    redirect('/dashboard');
  }

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
