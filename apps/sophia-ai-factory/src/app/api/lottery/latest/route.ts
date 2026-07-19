/** @module api/lottery/latest */
import { NextResponse } from 'next/server'
import { getLatestLottery } from '@/land/lottery'

export const runtime = 'edge'

export async function GET() {
  const result = await getLatestLottery()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  if (!result.data) {
    return NextResponse.json({ error: 'No lottery data available' }, { status: 404 })
  }
  return NextResponse.json(result.data)
}
