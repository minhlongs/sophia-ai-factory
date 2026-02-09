import { runIngestion } from '@/lib/ingestion/runner'
import { NextResponse } from 'next/server'

export const maxDuration = 300 // 5 minutes max duration for Vercel Pro/Enterprise

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Allow development override or check for a specific admin secret
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { networks } = await request.json().catch(() => ({ networks: undefined }))

    // Run ingestion
    const results = await runIngestion(networks)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
