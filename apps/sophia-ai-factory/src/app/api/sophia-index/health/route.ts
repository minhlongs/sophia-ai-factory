import { sophiaIndex } from '@/lib/supabase/sophia-index'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { data, error } = await sophiaIndex.getCategories()

    if (error) throw error

    return NextResponse.json({
      status: 'healthy',
      categories: data?.length || 0,
      message: 'Sophia Index connected'
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: (error as Error).message },
      { status: 500 }
    )
  }
}
