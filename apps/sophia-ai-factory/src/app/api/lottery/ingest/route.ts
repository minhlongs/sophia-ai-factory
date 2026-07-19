/** @module api/lottery/ingest */
import { NextResponse, NextRequest } from 'next/server'
import { verifyCronAuth } from '@/seed/security/cron-auth'
import { upsertLotteryRows } from '@/land/lottery'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { date?: string; prizes?: Record<string, string> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { date, prizes } = body
  if (!date || !prizes) {
    return NextResponse.json({ error: 'Missing required fields: date, prizes' }, { status: 400 })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date format, expected YYYY-MM-DD' }, { status: 400 })
  }

  const requiredPrizes = ['prize_1', 'prize_2', 'prize_3', 'prize_4', 'prize_5', 'prize_6', 'prize_7', 'prize_8']
  for (const key of requiredPrizes) {
    if (!(key in prizes)) {
      return NextResponse.json({ error: `Missing prize field: ${key}` }, { status: 400 })
    }
  }

  const result = await upsertLotteryRows(date, prizes as Record<string, string>)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 })
  }

  return NextResponse.json(result.data)
}
