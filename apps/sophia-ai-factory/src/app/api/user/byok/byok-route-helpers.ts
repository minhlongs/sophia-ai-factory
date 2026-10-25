/**
 * Request validation schemas and mutation helpers for /api/user/byok.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  setUserApiKey,
  clearUserApiKey,
  type ByokProvider,
} from '@/tree/byok/user-api-key-store'
import { track } from '@/tree/signals/track'
import { D1Events } from '@/tree/signals/d1-event-types'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import {
  validateProviderKey,
  sanitizeCredential,
  type ValidatorProvider,
} from '@/tree/byok/key-format-validators'
import { probeProviderApiKey } from '@/tree/byok/provider-probe'

export const PROVIDERS = [
  'openrouter',
  'anthropic',
  'elevenlabs',
  'd-id',
  'heygen',
  'muapi',
  'apollo',
  'hunter',
  'fal-ai',
  'replicate',
] as const

export const PostSchema = z
  .object({
    provider: z.enum(PROVIDERS),
    key: z.preprocess(
      (val) => (typeof val === 'string' ? sanitizeCredential(val) : val),
      z.string().min(10).max(500),
    ),
    validateLive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const validation = validateProviderKey(data.provider as ValidatorProvider, data.key)
    if (!validation.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['key'],
        message: `Invalid ${data.provider} key format`,
      })
    }
  })

export const DeleteSchema = z.object({
  provider: z.enum(PROVIDERS),
})

export async function upsertVerifiedByokKey(
  userId: string,
  provider: (typeof PROVIDERS)[number],
  key: string,
  validateLive?: boolean,
): Promise<NextResponse> {
  const validation = validateProviderKey(provider as ValidatorProvider, key)
  const finalKey = validation.ok && validation.autoEncoded ? validation.autoEncoded : key

  if (validateLive) {
    const probe = await probeProviderApiKey(provider, finalKey)
    if (
      !probe.valid &&
      (probe.status === 'INVALID' || probe.httpStatus === 401 || probe.httpStatus === 403)
    ) {
      return NextResponse.json(
        {
          error: probe.message,
          error_vi: probe.message_vi,
          provider,
          status: probe.status,
        },
        { status: 422 },
      )
    }
  }

  try {
    await setUserApiKey(userId, provider as ByokProvider, finalKey)
  } catch (err) {
    logger.warn('[byok-admin] setUserApiKey failed', {
      userId,
      provider,
      error: getErrorMessage(err),
    })
    return NextResponse.json({ error: 'Failed to store key' }, { status: 500 })
  }

  track(D1Events.BYOK_KEY_SET, userId, { provider })
  return NextResponse.json({ ok: true })
}

export async function removeUserByokKey(
  userId: string,
  provider: (typeof PROVIDERS)[number],
): Promise<NextResponse> {
  try {
    await clearUserApiKey(userId, provider as ByokProvider)
  } catch (err) {
    logger.warn('[byok-admin] clearUserApiKey failed', {
      userId,
      provider,
      error: getErrorMessage(err),
    })
    return NextResponse.json({ error: 'Failed to clear key' }, { status: 500 })
  }

  track(D1Events.BYOK_KEY_CLEARED, userId, { provider })
  return NextResponse.json({ ok: true })
}
