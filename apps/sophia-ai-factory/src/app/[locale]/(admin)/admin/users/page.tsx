import { createAdminClient } from "@/lib/supabase/admin";
import { AdminUsersClient } from "./admin-users-client";

export const dynamic = "force-dynamic";

interface SupabaseAuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  created_at: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  tier: string;
  status: "active" | "invited";
  createdAt: string;
}

/**
 * Admin Users Management page (server component).
 * Lists all Supabase Auth users with tier and status info.
 */
export default async function AdminUsersPage() {
  const supabaseAdmin = createAdminClient();

  let users: AdminUserRow[] = [];
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (!error && data?.users) {
      users = data.users.map((u: SupabaseAuthUser) => ({
        id: u.id,
        email: u.email || "N/A",
        tier: (u.user_metadata?.tier as string) || "BASIC",
        status: u.email_confirmed_at ? "active" : "invited",
        createdAt: u.created_at,
      }));
    }
  } catch {
    // Admin client may fail if SERVICE_ROLE_KEY is missing
  }

  return <AdminUsersClient initialUsers={users} />;
}
