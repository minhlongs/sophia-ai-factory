import { sophiaIndex } from '@/lib/supabase/sophia-index'
import { toError } from '@/lib/utils/to-error'
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
      { status: 'error', message: toError(error).message },
      { status: 500 }
    )
  }
}
