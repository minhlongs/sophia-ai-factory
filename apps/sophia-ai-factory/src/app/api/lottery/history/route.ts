/** @module api/lottery/history */
import { NextResponse } from 'next/server'
import { getLotteryHistory } from '@/land/lottery'

export const runtime = 'edge'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20))
  const offset = (page - 1) * limit

  const result = await getLotteryHistory(offset, limit)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    rows: result.data.rows,
    pagination: {
      page,
      limit,
      total: result.data.total,
      totalPages: Math.ceil(result.data.total / limit),
    },
  })
}
