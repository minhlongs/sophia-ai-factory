import { type Database } from '@/tree/database/supabase-types'

export type Product = Database['public']['Tables']['affiliate_products']['Row']

export interface DiscoveryFilters {
  q?: string
  category?: number
  minSps?: number
  hiddenGemsOnly?: boolean
  sort?: 'sps_score' | 'updated_at' | 'avg_earnings_usd'
}
