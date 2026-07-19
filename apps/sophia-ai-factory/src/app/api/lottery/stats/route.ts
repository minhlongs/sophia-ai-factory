/** @module api/lottery/stats */
import { NextResponse } from 'next/server'
import { getLotteryHistory, extractAllTwoDigits, computeTwoDigitStats, computeHotCold } from '@/land/lottery'

export const runtime = 'edge'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const hotCount = Math.min(20, Math.max(1, parseInt(url.searchParams.get('hot') || '10', 10) || 10))

  const history = await getLotteryHistory(0, 500)
  if (!history.ok) {
    return NextResponse.json({ error: history.error }, { status: 500 })
  }

  const twoDigits = extractAllTwoDigits(history.data.rows)
  const stats = computeTwoDigitStats(twoDigits)
  const { hot, cold } = computeHotCold(stats, hotCount)

  return NextResponse.json({ hot, cold })
}
