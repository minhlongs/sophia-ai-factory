/** @module api/lottery/health */
import { NextResponse } from 'next/server'
import { getRowCount } from '@/land/lottery'

export const runtime = 'edge'

export async function GET() {
  const dbReady = typeof process !== 'undefined' && !!process.env

  let rowCount: number | null = null
  if (dbReady) {
    rowCount = await getRowCount()
  }

  return NextResponse.json({
    ok: true,
    dbReady,
    rowCount,
  })
}
