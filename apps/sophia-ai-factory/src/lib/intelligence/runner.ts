import { supabase } from '@/lib/supabase/client'
import { scoringService } from './scoring'
import type { ScorableProduct } from './types'
import type { Database } from '@/lib/supabase/types'

type AffiliateProduct = Database['public']['Tables']['affiliate_products']['Row']

export async function runScoringBatch(limit: number = 1000, offset: number = 0) {

  // 1. Fetch products
  const { data, error } = await supabase
    .from('affiliate_products')
    .select('*')
    .range(offset, offset + limit - 1)

  if (error) {
    throw new Error(`Failed to fetch products for scoring: ${error.message}`)
  }

  const products = data as AffiliateProduct[] | null

  if (!products || products.length === 0) {
    return { processed: 0, updated: 0 }
  }


  const updates = []

  // 2. Calculate scores
  for (const product of products) {
    const scorable: ScorableProduct = {
      network_id: product.network_id,
      avg_earnings_usd: product.avg_earnings_usd,
      raw_metrics: product.raw_metrics as Record<string, unknown>
    }

    const scoreResult = scoringService.calculateScore(scorable)

    // Only update if score changed (optimization) - or just update all for now
    updates.push({
      id: product.id,
      sps_score: scoreResult.sps_score,
      is_hidden_gem: scoreResult.is_hidden_gem
    })
  }

  // 3. Bulk Update
  // Supabase upsert requires all fields for atomic updates or primary key match.
  // Since we are updating specific fields for existing IDs, we can use upsert.
  // However, we only want to update `sps_score` and `is_hidden_gem`.
  // Supabase/PostgREST doesn't support "Patch multiple rows with different values" easily in one HTTP call without a custom RPC or upserting the whole row (which we don't have here, we only fetched raw).
  // Actually, we fetched `*`, so we could upsert `*` with modified values.
  // Better approach for large batch: Use upsert with minimal fields if table allows (ignore other non-null constraints? No, upsert needs full row if not partial).
  // Actually, `upsert` works with partial data if we only touch columns that are nullable or have defaults? No, it updates the row.
  // If we just send ID + fields to update, Supabase Upsert works as "Update if exists" on PK.
  // Let's try sending just ID and the fields to update.

  const { error: updateError } = await supabase
    .from('affiliate_products')
    // @ts-expect-error - Known Supabase typing limitation with upsert on tables with Json columns
    .upsert(updates as unknown as Database['public']['Tables']['affiliate_products']['Update'][], { onConflict: 'id', ignoreDuplicates: false })

  if (updateError) {
    // Fallback: update sequentially if bulk fails (slow but safe)
    // Or throw
    throw new Error(`Bulk update failed: ${updateError.message}`)
  }

  return { processed: products.length, updated: updates.length }
}

export async function scoreAllProducts() {
  const BATCH_SIZE = 500
  let offset = 0
  let totalProcessed = 0
  let hasMore = true

  while (hasMore) {
    const { processed } = await runScoringBatch(BATCH_SIZE, offset)
    totalProcessed += processed
    offset += BATCH_SIZE

    if (processed < BATCH_SIZE) {
      hasMore = false
    }
  }

  return { total: totalProcessed }
}
