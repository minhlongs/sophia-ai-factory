/**
 * Supabase Client Wrapper
 * Re-exports Supabase clients from original location for centralized access
 */

export { supabase } from '../supabase/client';
export { createClient as createServerClient } from '../supabase/server';
export type { Database } from '../supabase/types';

// Re-export for convenience
import { supabase as client } from '../supabase/client';
export default client;
