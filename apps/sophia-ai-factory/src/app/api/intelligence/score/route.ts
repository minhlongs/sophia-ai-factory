import { scoreAllProducts } from '@/lib/intelligence/runner'
import { toError } from '@/lib/utils/to-error'
import { NextResponse } from 'next/server'

export const maxDuration = 300 // 5 minutes

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

    const result = await scoreAllProducts()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: toError(error).message },
      { status: 500 }
    )
  }
}
