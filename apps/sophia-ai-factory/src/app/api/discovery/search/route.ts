import { NextResponse } from 'next/server'
import { sophiaIndex } from '@/lib/supabase/sophia-index'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  try {
    const { data, error } = await sophiaIndex.search(q)

    if (error) throw error

    // Filter sensitive fields for public API (if RLS doesn't already)
    // For now, we return what sophiaIndex returns, which is currently `*`.
    // In a real app, we might map this to a DTO to exclude affiliate_link.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const safeData = data?.map((item: any) => ({
      ...item,
      affiliate_link: undefined, // Hide link in search results
      raw_metrics: undefined // Hide raw metrics
    }))

    return NextResponse.json({ data: safeData })
  } catch (error) {
    return NextResponse.json(
      { error: 'Search failed', details: (error as Error).message },
      { status: 500 }
    )
  }
}
