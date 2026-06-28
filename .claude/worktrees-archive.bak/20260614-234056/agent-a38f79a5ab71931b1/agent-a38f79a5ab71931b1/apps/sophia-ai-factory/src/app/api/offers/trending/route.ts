/**
 * Trending Offers API Route
 *
 * GET /api/offers/trending?network=tiktok-shop&niche=beauty&limit=50
 * Returns trending affiliate offers across specified or all networks.
 * Public (read-only) — no auth required for browsing.
 *
 * @module app/api/offers/trending/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTrendingOffers } from '@/land/affiliates/trending-discovery'
import { z } from 'zod'

const QuerySchema = z.object({
  network: z.string().optional(),
  niche: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  const raw = {
    network: url.searchParams.get('network') ?? undefined,
    niche: url.searchParams.get('niche') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  }

  const parsed = QuerySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid query params', details: parsed.error.issues }, { status: 400 })
  }

  const offers = await getTrendingOffers(parsed.data)
  return NextResponse.json({ offers, count: offers.length })
}
