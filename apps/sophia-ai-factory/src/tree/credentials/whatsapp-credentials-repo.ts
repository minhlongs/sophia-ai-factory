/**
 * whatsapp-credentials-repo.ts — WhatsApp Business credential storage
 *
 * Writes to the `whatsapp_templates` D1 table (migration 0230).
 * Encrypts wa_token with byok-crypto before persisting.
 */

import { getD1 } from '@/seed/db/client'
import { encryptApiKey } from '@/tree/byok/byok-crypto'
import { logger } from '@/seed/utils/logger-utility'

export interface WhatsAppCredentialInput {
  phoneNumberId: string
  waToken: string
  wabaId?: string
  businessId?: string
}

export interface WhatsAppCredentialRecord {
  id: number
  userId: string
  phoneNumberId: string
  waTokenEncrypted: string
  wabaId: string | null
  businessId: string | null
  isDefault: number
  createdAt: string
  updatedAt: string
}

/**
 * Upsert WhatsApp Business credential for a user.
 * Idempotent — re-call rotates wa_token.
 */
export async function upsertWhatsAppCredential(
  userId: string,
  input: WhatsAppCredentialInput,
): Promise<void> {
  if (!userId) throw new Error('userId is required')
  if (!input.phoneNumberId) throw new Error('phoneNumberId is required')
  if (!input.waToken) throw new Error('waToken is required')

  const d1 = getD1()
  if (!d1) throw new Error('D1 binding not available')

  const encrypted = await encryptApiKey(input.waToken)
  const nowIso = new Date().toISOString()

  await d1
    .prepare(
      `INSERT INTO whatsapp_templates
        (user_id, phone_number_id, wa_token, waba_id, business_id, is_default, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7)
       ON CONFLICT(user_id, phone_number_id) DO UPDATE SET
         wa_token = excluded.wa_token,
         waba_id = excluded.waba_id,
         business_id = excluded.business_id,
         updated_at = excluded.updated_at`,
    )
    .bind(userId, input.phoneNumberId, encrypted, input.wabaId ?? null, input.businessId ?? null, nowIso, nowIso)
    .run()

  logger.info('[WhatsAppCreds] Credential upserted', { userId, phoneNumberId: input.phoneNumberId })
}

/**
 * Retrieve stored credential metadata for a user (no plaintext).
 */
export async function listWhatsAppCredentials(userId: string): Promise<WhatsAppCredentialRecord[]> {
  const d1 = getD1()
  if (!d1) return []

  const { results } = await d1
    .prepare(
      `SELECT id, user_id, phone_number_id, wa_token, waba_id, business_id, is_default, created_at, updated_at
         FROM whatsapp_templates
        WHERE user_id = ?1
        ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<WhatsAppCredentialRecord>()

  return results ?? []
}

/**
 * Delete a WhatsApp credential by id.
 */
export async function deleteWhatsAppCredential(userId: string, id: number): Promise<void> {
  const d1 = getD1()
  if (!d1) throw new Error('D1 binding not available')

  const result = await d1
    .prepare('DELETE FROM whatsapp_templates WHERE id = ?1 AND user_id = ?2')
    .bind(id, userId)
    .run()

  if ((result.meta?.changes ?? 0) === 0) {
    throw new Error('Credential not found')
  }

  logger.info('[WhatsAppCreds] Credential deleted', { userId, id })
}