import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null

/**
 * Get singleton browser Supabase client.
 * Lazy-initialized to avoid module-level throws during build/test.
 */
export function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  supabaseInstance = createClient<Database>(supabaseUrl, supabaseKey)
  return supabaseInstance
}

// Backward-compatible export — delegates to lazy singleton
// Callers should migrate to getSupabaseClient() for explicit initialization
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_target, prop) {
    return Reflect.get(getSupabaseClient(), prop)
  }
})
