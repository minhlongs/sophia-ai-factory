import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'
import { integrationSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate with Zod
    const validation = integrationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { network, api_key, api_secret } = validation.data

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const integrationData: Database['public']['Tables']['user_integrations']['Insert'] = {
      user_id: user.id,
      network_id: network,
      api_key,
      api_secret: api_secret || null,
      updated_at: new Date().toISOString()
    }

    // Upsert integration
    const { error } = await supabase
      .from('user_integrations')
      // @ts-expect-error - Known Supabase typing limitation with upsert on typed tables
      .upsert(integrationData as unknown as Database['public']['Tables']['user_integrations']['Insert'])

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save integration' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_integrations')
      .select('network_id, is_active, created_at')
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ integrations: data })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
