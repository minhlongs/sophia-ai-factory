/**
 * POST /api/setup-wizard/save-credentials
 *
 * Saves user provider credentials (HeyGen, Resend, NOWPayments) encrypted
 * to the user_provider_credentials D1 table.
 * When heygen_api_key is saved, auto-registers Sophia's webhook with HeyGen API.
 * Auth required. Input validated via Zod.
 *
 * @module app/api/setup-wizard/save-credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { setUserCredential } from '@/tree/credentials/user-credentials-repo'
import {
  saveCredentialsSchema,
  buildSaveList,
  handleHeyGenWebhookAutoRegister,
  markOnboardingCompleteAndWelcome,
} from './save-credentials-helpers'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = saveCredentialsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 },
    )
  }

  const saves = buildSaveList(parsed.data)
  if (saves.length === 0) {
    return NextResponse.json({ success: false, message: 'No credentials provided' }, { status: 400 })
  }

  const credErrors: string[] = []
  for (const { provider, key } of saves) {
    try {
      await setUserCredential(user.id, provider, key)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      credErrors.push(`${provider}: ${msg}`)
    }
  }

  const webhookRegistered = await handleHeyGenWebhookAutoRegister(
    user.id,
    parsed.data.heygen_api_key,
    credErrors,
  )

  if (credErrors.some((e) => !e.startsWith('webhook:'))) {
    return NextResponse.json(
      { success: false, message: credErrors.filter((e) => !e.startsWith('webhook:')).join('; ') },
      { status: 500 },
    )
  }

  await markOnboardingCompleteAndWelcome(user, parsed.data.routing_strategy)
  const webhookErrors = credErrors.filter((e) => e.startsWith('webhook:'))

  return NextResponse.json({
    success: true,
    saved: saves.map((s) => s.provider),
    webhook_registered: webhookRegistered,
    ...(webhookErrors.length > 0 ? { errors: webhookErrors } : {}),
  })
}
