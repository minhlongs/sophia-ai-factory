import { NextResponse } from 'next/server'
import { sophiaIndex } from '@/lib/supabase/sophia-index'

export const revalidate = 3600 // Cache for 1 hour (ISR)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
    ? parseInt(searchParams.get('category')!)
    : undefined
  const hiddenGemsOnly = searchParams.get('hidden_gems') === 'true'

  try {
    const { data, error } = await sophiaIndex.getTop50({
      category,
      hiddenGemsOnly
    })

    if (error) throw error

    // Safety filter
    const safeData = data?.map((item: Record<string, unknown>) => ({
      ...item,
      affiliate_link: undefined,
      raw_metrics: undefined
    }))

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      count: safeData?.length || 0,
      data: safeData
    })
  } catch {
    return NextResponse.json(
      { error: 'Fetch failed' },
      { status: 500 }
    )
  }
}
