import { createServerClient } from '@/seed/db/client'
import type { IngestionAdapter, IngestionResult, RawProduct } from './types'
import type { Database, Json } from '@/lib/supabase/types'
import Bottleneck from 'bottleneck'

type AffiliateProductInsert = Database['public']['Tables']['affiliate_products']['Insert']

export abstract class BaseAdapter implements IngestionAdapter {
  abstract networkId: 'clickbank' | 'shareasale' | 'amazon'
  protected limiter: Bottleneck

  constructor(requestsPerMinute: number = 60) {
    this.limiter = new Bottleneck({
      minTime: 60000 / requestsPerMinute,
      maxConcurrent: 1,
    })
  }

  abstract fetchProducts(): Promise<RawProduct[]>

  /**
   * Upserts a batch of products into Supabase.
   * Handles de-duplication and updates existing records.
   */
  async upsertProducts(products: RawProduct[]): Promise<IngestionResult> {
    const result: IngestionResult = {
      total: products.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    }

    if (products.length === 0) {
      return result
    }

    // Process in chunks to avoid hitting Supabase limits
    const CHUNK_SIZE = 100
    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE)

      const dbRows: AffiliateProductInsert[] = chunk.map(p => ({
        external_id: p.external_id,
        network_id: p.network_id,
        title: p.title,
        description: p.description ?? null,
        affiliate_link: p.affiliate_link,
        thumbnail_url: p.thumbnail_url ?? null,
        price_usd: p.price_usd ?? null,
        commission_rate: p.commission_rate ?? null,
        avg_earnings_usd: p.avg_earnings_usd ?? null,
        raw_metrics: p.raw_metrics as unknown as Json,
        category_id: p.category_id ?? null,
        // Calculate basic SPS score placeholder (will be updated by scoring engine later)
        sps_score: 0,
        is_hidden_gem: false,
      }))

      const db = createServerClient()
      const { error } = await db
        .from('affiliate_products')
        // @ts-expect-error - Known Supabase typing limitation with upsert on tables with Json columns
        .upsert(dbRows as unknown as Database['public']['Tables']['affiliate_products']['Insert'][], {
          onConflict: 'network_id,external_id',
          ignoreDuplicates: false
        })

      if (error) {
        result.failed += chunk.length
        result.errors.push(`Batch upsert failed: ${error.message}`)
      } else {
        result.processed += chunk.length
      }
    }

    return result
  }

  protected async mapCategory(_networkCategory: string): Promise<number | null> { // eslint-disable-line @typescript-eslint/no-unused-vars
    return null
  }
}
