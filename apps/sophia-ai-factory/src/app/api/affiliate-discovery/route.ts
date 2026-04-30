/**
 * GET /api/affiliate-discovery
 *
 * Returns paginated affiliate offers from affiliate_offers_selected.
 * Public endpoint — rate limited 60 req/min.
 *
 * Query params:
 *   page  — page number (default: 1, min: 1)
 *   limit — items per page (default: 50, max: 100)
 *
 * Response: { offers: AffiliateOffer[], total: number, page: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/db/client'
import { withRateLimit } from '@/middleware/rate-limit-wrapper'

export interface AffiliateOffer {
  id: string
  offer_name: string
  network: string
  commission_rate: number | null
  created_at: string | null
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const GET = withRateLimit(
  async function GET(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url)

    const parsed = querySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { page, limit } = parsed.data
    const offset = (page - 1) * limit

    try {
      const db = createServerClient()

      // Fetch rows and count in parallel
      const [rowsResult, countResult] = await Promise.all([
        db
          .from('affiliate_offers_selected')
          .select('id, offer_name, network, commission_rate, created_at')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1),
        db
          .from('affiliate_offers_selected')
          .select('id', { count: 'exact', head: true }),
      ])

      const offers = (rowsResult.data ?? []) as unknown as AffiliateOffer[]
      const total = (countResult.count ?? 0) as number

      return NextResponse.json({ offers, total, page })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Database error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  },
  { config: { intervalMs: 60_000, maxRequests: 60 } },
)
