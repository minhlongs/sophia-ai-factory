import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Default to a valid-looking URL to avoid crashes during build/static generation if env vars are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
