import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with admin/service-role privileges.
 * ONLY use server-side for admin operations (user management, etc.).
 * Never expose the service role key to the client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
