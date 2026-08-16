/**
 * POST /api/setup-wizard/save-whatsapp-credentials
 *
 * Saves WhatsApp Business Cloud API credentials encrypted
 * to the whatsapp_templates D1 table.
 * Auth required. Input validated via Zod.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { upsertWhatsAppCredential } from '@/tree/credentials/whatsapp-credentials-repo'
import { logger } from '@/seed/utils/logger-utility'

const BodySchema = z.object({
  phoneNumberId: z.string().min(10, 'Phone Number ID must be at least 10 characters'),
  waToken: z.string().min(20, 'WA Token appears too short'),
  wabaId: z.string().optional(),
  businessId: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })

    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'INVALID_BODY', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { phoneNumberId, waToken, wabaId, businessId } = parsed.data

    await upsertWhatsAppCredential(user.id, {
      phoneNumberId,
      waToken,
      wabaId,
      businessId,
    })

    logger.info('[SaveWhatsAppCreds] Saved', { userId: user.id, phoneNumberId })
    return NextResponse.json({ status: 'saved' }, { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('[SaveWhatsAppCreds] Failed', { error: msg })
    return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 })
  }
}