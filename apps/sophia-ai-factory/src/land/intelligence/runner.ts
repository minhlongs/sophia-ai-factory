import { createServerClient } from '@/seed/db/client'
import { scoringService } from './scoring'
import type { ScorableProduct } from './types'
import type { Database } from '@/tree/database/supabase-types'

type AffiliateProduct = Database['public']['Tables']['affiliate_products']['Row']

export async function runScoringBatch(limit: number = 1000, offset: number = 0) {
  const db = createServerClient()

  // 1. Fetch products
  const { data, error } = await db
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

    updates.push({
      id: product.id,
      sps_score: scoreResult.sps_score,
      is_hidden_gem: scoreResult.is_hidden_gem
    })
  }

  // 3. Bulk update scores via upsert (ID + changed fields only)

  // D1Client.upsert accepts an array of rows (each is run as its own
  // INSERT ... ON CONFLICT DO UPDATE statement). The narrow cast erases the
  // Supabase-generated table types only — the array shape is preserved. The
  // dropped `{ onConflict, ignoreDuplicates }` second arg was a Supabase-only
  // hint that D1's bare `ON CONFLICT DO UPDATE` already supersedes.
  const { error: updateError } = await db
    .from('affiliate_products')
    .upsert(updates as unknown as Record<string, unknown>[])

  if (updateError) {
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
