/**
 * Sophia Index — D1-backed product discovery layer.
 *
 * Drop-in replacement for the deleted Supabase sophia-index module.
 * Uses D1Client from @/seed/db/client with the same chainable API
 * as the Supabase client (.from().select().eq().order().limit().single()).
 */

import { createServerClient } from '@/seed/db/client';

export const sophiaIndex = {
  // Get Top 50 products by SPS score
  async getTop50(filters?: {
    category?: number;
    minCommission?: number;
    hiddenGemsOnly?: boolean;
  }) {
    const db = createServerClient();
    let query = db
      .from('affiliate_products')
      .select('*')
      .order('sps_score', { ascending: false })
      .limit(50);

    if (filters?.category) {
      query = query.eq('category_id', filters.category);
    }
    if (filters?.minCommission) {
      query = query.gte('commission_rate', filters.minCommission);
    }
    if (filters?.hiddenGemsOnly) {
      query = query.eq('is_hidden_gem', true);
    }

    return query;
  },

  // Search products (D1/SQLite — LIKE substring match; full-text search unavailable).
  // Escape LIKE metacharacters so user input cannot inject wildcards on this
  // public endpoint (e.g. "%" would scan the entire table).
  async search(query: string) {
    const db = createServerClient();
    const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
    return db
      .from('affiliate_products')
      .select('*')
      .ilike('title', `%${escaped}%`)
      .order('sps_score', { ascending: false })
      .limit(20);
  },

  // Get product by ID
  async getById(id: string) {
    const db = createServerClient();
    return db
      .from('affiliate_products')
      .select('*')
      .eq('id', id)
      .single();
  },

  // Get categories
  async getCategories() {
    const db = createServerClient();
    return db
      .from('affiliate_categories')
      .select('*')
      .order('name');
  },
};
