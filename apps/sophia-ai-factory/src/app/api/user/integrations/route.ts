import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

export async function POST(request: NextRequest) {
  try {
    const { network, api_key, api_secret } = await request.json()

    // Validate network
    if (network !== 'clickbank' && network !== 'shareasale' && network !== 'amazon') {
      return NextResponse.json({ error: 'Invalid network' }, { status: 400 })
    }

    const networkId = network as 'clickbank' | 'shareasale' | 'amazon'

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const integrationData: Database['public']['Tables']['user_integrations']['Insert'] = {
      user_id: user.id,
      network_id: networkId,
      api_key,
      api_secret: api_secret || null,
      updated_at: new Date().toISOString()
    }

    // Upsert integration
    const { error } = await supabase
      .from('user_integrations')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(integrationData as any)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Integration save error:', error)
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
