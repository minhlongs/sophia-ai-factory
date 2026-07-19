'use server'

import { agencyRegisterSchema, type AgencyRegisterInput } from './schema'
import { createAgency } from '@/seed/db/repositories/agency-repo'
import { hashApiKey, createAgencyApiKey } from '@/seed/db/agency-api-key'
import { validateAgencySlug } from '@/seed/validators/agency-slug.validator'
import { success, failure, type Result } from '@/seed/types/result'
import { logger } from '@/seed/utils/logger-utility'

export interface AgencyRegistrationResult {
  agencyId: number
  slug: string
  apiKey: string
  messageVi: string
  messageEn: string
}

/**
 * Check if a slug already exists.
 * Returns true if taken.
 */
async function isSlugTaken(slug: string): Promise<boolean> {
  const { findBySlug } = await import('@/seed/db/repositories/agency-repo')
  return (await findBySlug(slug)) != null
}

/**
 * Agency Register Action
 *
 * Flow: validate → slug uniqueness check (with reserved) → generate key →
 *       hash → insert → return plaintext API key ONCE.
 *
 * Raw key is never stored. The hash goes to D1. Plaintext returned once
 * in the success Result and must be captured by the caller.
 */
export async function agencyRegisterAction(
  input: unknown,
): Promise<Result<AgencyRegistrationResult, { code: string; message: string }>> {
  const parsed = agencyRegisterSchema.safeParse(input)

  if (!parsed.success) {
    return failure({
      code: 'VALIDATION_ERROR',
      message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    })
  }

  const data: AgencyRegisterInput = parsed.data
  const log = logger.child('agency-register-action')

  log.info('Agency registration attempt', { slug: data.slug, ownerUserId: data.ownerUserId })

  // ── Slug validation (reserved check) ───────────────────────────────────────

  const slugValidation = validateAgencySlug(data.slug)
  if (!slugValidation.ok) {
    log.warn('Slug rejected by reserved check', { slug: data.slug, code: slugValidation.error.code })
    return failure(slugValidation.error)
  }

  // ── DB uniqueness check ────────────────────────────────────────────────────

  try {
    const taken = await isSlugTaken(data.slug)
    if (taken) {
      log.warn('Duplicate agency slug', { slug: data.slug })
      return failure({ code: 'SLUG_TAKEN', message: 'This agency slug is already registered' })
    }
  } catch {
    return failure({ code: 'SLUG_TAKEN', message: 'This agency slug is already registered' })
  }

  // ── Key generation ────────────────────────────────────────────────────────

  let apiKeyPair: { key: string; hash: string }
  try {
    apiKeyPair = createAgencyApiKey()
  } catch {
    return failure({ code: 'KEY_GENERATION_FAILED', message: 'Failed to generate API key' })
  }

  // ── Insert agency ──────────────────────────────────────────────────────────

  const now = Math.floor(Date.now() / 1000)

  const result = await createAgency({
    slug: data.slug,
    name: data.name,
    apiKeyHash: apiKeyPair.hash,
    apiKeyPrefix: apiKeyPair.key.slice(0, 8),
    ownerUserId: data.ownerUserId,
    billingEmail: data.billingEmail ?? null,
    tier: data.tier,
  })

  if (!result.ok) {
    const slugTaken =
      result.error.code === 'AGENCY_CREATE_FAILED' ||
      typeof result.error.message === 'string' &&
        (result.error.message as string).includes('UNIQUE constraint')

    if (slugTaken) {
      return failure({ code: 'SLUG_TAKEN', message: 'This agency slug is already registered' })
    }
    return failure({ code: 'INSERT_FAILED', message: result.error.message })
  }

  log.info('Agency registered successfully', { agencyId: result.value.id, slug: data.slug })

  return success({
    agencyId: result.value.id,
    slug: data.slug,
    apiKey: apiKeyPair.key,
    messageVi: `Agency "${data.slug}" đã được tạo. Lưu API key — nó sẽ không hiển thị lại.`,
    messageEn: `Agency "${data.slug}" created. Save this API key — it will not be shown again.`,
  })
}
