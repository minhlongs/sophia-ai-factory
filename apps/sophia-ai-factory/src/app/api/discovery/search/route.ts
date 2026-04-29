import { NextRequest, NextResponse } from 'next/server'
import { sophiaIndex } from '@/lib/supabase/sophia-index'
import { getCurrentUser } from '@/lib/better-auth-session'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  try {
    const { data, error } = await sophiaIndex.search(q)

    if (error) throw error

    // Filter sensitive fields from public API response
    const safeData = data?.map((item: Record<string, unknown>) => ({
      ...item,
      affiliate_link: undefined, // Hide link in search results
      raw_metrics: undefined // Hide raw metrics
    }))

    return NextResponse.json({ data: safeData })
  } catch {
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
