/**
 * API Endpoint: GET /api/admin/licenses
 * Danh sách license keys với pagination, search, filter
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLicenses } from '@/lib/raas-audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { logger } from '@/lib/utils/logger-utility'
import type { LicenseTier } from '@/lib/raas-schema'
import { z } from 'zod'

/**
 * Query params validation schema
 */
const licenseListSchema = z.object({
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(['active', 'revoked', 'expired']).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

/**
 * GET /api/admin/licenses?tier=premium&search=abc&status=active&page=1&limit=20
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const searchParams = request.nextUrl.searchParams
    const params = licenseListSchema.parse(Object.fromEntries(searchParams))

    const result = await getLicenses({
      tier: params.tier,
      search: params.search,
      status: params.status,
      page: params.page,
      limit: params.limit
    })

    return NextResponse.json(result)

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid query parameters', { issues: error.issues })
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('API: GET /api/admin/licenses failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to fetch licenses' },
      { status: 500 }
    )
  }
}
