/**
 * Discover Affiliate Offers Server Action
 *
 * Authenticated Server Action that triggers the agentic discovery wave
 * across ClickBank, Awin, and ShareASale with quality scoring and scam risk gating.
 *
 * Layer: land (business workflow)
 * @module affiliates/actions/discover-offers-action
 */

'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { resolveOrgId } from '@/seed/auth/resolve-org-id'
import { createServerClient } from '@/seed/db/client'
import { runAgenticDiscoveryWave, type DiscoveryWaveResult } from '../discovery-wave'
import { success, failure, type Result } from '@/seed/types/result'
import { logger } from '@/seed/utils/logger-utility'

const discoverOffersSchema = z.object({
  niche: z.string().min(1).max(100).default('saas'),
  minScore: z.number().min(0).max(1).default(0.5),
  limit: z.number().int().min(1).max(100).default(20),
  networks: z
    .array(z.enum(['clickbank', 'awin', 'shareasale']))
    .min(1)
    .default(['clickbank', 'awin', 'shareasale']),
})

export type DiscoverAffiliateOffersInput = z.input<typeof discoverOffersSchema>

export interface DiscoverOffersActionError {
  code: 'UNAUTHORIZED' | 'INVALID_INPUT' | 'EXECUTION_FAILED'
  message: string
}

export async function discoverAffiliateOffersAction(
  input: DiscoverAffiliateOffersInput = {},
): Promise<Result<DiscoveryWaveResult, DiscoverOffersActionError>> {
  const user = await getCurrentUser()
  if (!user?.id) {
    return failure({
      code: 'UNAUTHORIZED',
      message: 'Authentication required to run affiliate discovery wave',
    })
  }

  const parsed = discoverOffersSchema.safeParse(input)
  if (!parsed.success) {
    return failure({
      code: 'INVALID_INPUT',
      message: parsed.error.issues.map((i) => i.message).join('; '),
    })
  }

  try {
    const db = createServerClient()
    const orgId = await resolveOrgId(user.id, db)
    const tenantId = orgId ?? user.id

    const waveResult = await runAgenticDiscoveryWave({
      niche: parsed.data.niche,
      minScore: parsed.data.minScore,
      limit: parsed.data.limit,
      networks: parsed.data.networks,
      tenantId,
    })

    if (!waveResult.ok) {
      return failure({
        code: 'EXECUTION_FAILED',
        message: waveResult.error.message,
      })
    }

    return success(waveResult.value)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[discover-offers-action] failed unexpectedly', { error: message, userId: user.id })
    return failure({
      code: 'EXECUTION_FAILED',
      message,
    })
  }
}
