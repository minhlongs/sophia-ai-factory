import { supabase } from './client'

export const sophiaIndex = {
  // Get Top 50 products by SPS score
  async getTop50(filters?: {
    category?: number
    minCommission?: number
    hiddenGemsOnly?: boolean
  }) {
    let query = supabase
      .from('affiliate_products')
      .select('*')
      .order('sps_score', { ascending: false })
      .limit(50)

    if (filters?.category) {
      query = query.eq('category_id', filters.category)
    }
    if (filters?.minCommission) {
      query = query.gte('commission_rate', filters.minCommission)
    }
    if (filters?.hiddenGemsOnly) {
      query = query.eq('is_hidden_gem', true)
    }

    return query
  },

  // Search products (D1/SQLite — LIKE substring match; full-text search unavailable).
  // Escape LIKE metacharacters so user input cannot inject wildcards on this
  // public endpoint (e.g. "%" would scan the entire table).
  async search(query: string) {
    const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`)
    return supabase
      .from('affiliate_products')
      .select('*')
      .ilike('title', `%${escaped}%`)
      .order('sps_score', { ascending: false })
      .limit(20)
  },

  // Get product by ID
  async getById(id: string) {
    return supabase
      .from('affiliate_products')
      .select('*')
      .eq('id', id)
      .single()
  },

  // Get categories
  async getCategories() {
    return supabase
      .from('affiliate_categories')
      .select('*')
      .order('name')
  }
}
