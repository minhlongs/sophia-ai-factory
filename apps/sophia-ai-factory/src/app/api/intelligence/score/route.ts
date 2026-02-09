import { scoreAllProducts } from '@/lib/intelligence/runner'
import { NextResponse } from 'next/server'

export const maxDuration = 300 // 5 minutes

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const result = await scoreAllProducts()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
