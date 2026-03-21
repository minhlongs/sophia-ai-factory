import { createClient } from "@supabase/supabase-js";

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// Validate non-null after checks (TypeScript needs this)
const url = supabaseUrl as string;
const anonKey = supabaseAnonKey as string;
const serviceKey = supabaseServiceKey as string;

// Client-side / Edge client (uses anon key, respects RLS)
export function createBrowserClient() {
  return createClient(url, anonKey);
}

// Server-side client (uses service role key, bypasses RLS - use with caution)
export function createServerClient() {
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for server client");
  }
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Server client with user auth context (respects RLS)
export function createAuthClient(accessToken?: string) {
  return createClient(url, anonKey, {
    global: {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Re-export common types
export type { User, Session, AuthError } from "@supabase/supabase-js";
export type { PostgrestError } from "@supabase/supabase-js";
