import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/seed/db/client'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getUserTier } from '@/seed/db/get-user-tier'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { integrationSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Custom integrations are gated to ENTERPRISE and MASTER tiers
    const tier = await getUserTier(user.id)
    if (!UNIFIED_TIERS[tier].customIntegrations) {
      return NextResponse.json(
        { error: 'Custom integrations require Premium or Master plan.' },
        { status: 403 }
      )
    }

    const db = createServerClient()

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

    const integrationData = {
      user_id: user.id,
      network_id: network,
      api_key,
      api_secret: api_secret || null,
      updated_at: new Date().toISOString()
    }

    // Upsert integration
    const { error } = await db
      .from('user_integrations')
      .upsert(integrationData)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to save integration' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Custom integrations are gated to ENTERPRISE and MASTER tiers
    const tier = await getUserTier(user.id)
    if (!UNIFIED_TIERS[tier].customIntegrations) {
      return NextResponse.json(
        { error: 'Custom integrations require Premium or Master plan.' },
        { status: 403 }
      )
    }

    const db = createServerClient()

    const { data, error } = await db
      .from('user_integrations')
      .select('network_id, is_active, created_at')
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ integrations: data })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
