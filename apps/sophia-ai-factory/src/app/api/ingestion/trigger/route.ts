import { runIngestion } from '@/lib/ingestion/runner'
import { NextResponse } from 'next/server'

export const maxDuration = 300 // 5 minutes max duration for Vercel Pro/Enterprise

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Server misconfiguration: CRON_SECRET not set' },
        { status: 500 }
      )
    }

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
