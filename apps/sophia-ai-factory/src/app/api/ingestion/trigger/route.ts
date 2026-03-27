import { runIngestion } from '@/lib/ingestion/runner'
import { NextResponse } from 'next/server'
import { ingestionTriggerRequestSchema } from '@/lib/validation/services'
import { withRateLimit } from '@/middleware/rate-limit-wrapper'

export const maxDuration = 300 // 5 minutes max duration for Cloudflare Workers

// Wrap handler with rate limiting (100 requests per minute for ingestion)
export const POST = withRateLimit(async function POST(request: Request) {
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

    // Parse and validate request body with Zod
    const body = await request.json().catch(() => ({}))
    const validation = ingestionTriggerRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.flatten()
        },
        { status: 400 }
      )
    }

    const { networks } = validation.data

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
}, { addHeaders: true });
