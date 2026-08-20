/**
 * whatsapp-message-logger.ts — Message delivery logger for WhatsApp Business.
 *
 * Persists each publish attempt into `whatsapp_message_log`
 * so report/admin pages can show delivery state.
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

export interface WhatsAppMessageLogInput {
  userId: number
  templateId: number
  channel: string
  direction: 'outbound' | 'inbound'
  recipient: string
  externalMessageId?: string | null
  status?: string
  errorCode?: string | null
  errorMessage?: string | null
  errorCategory?: string | null
  sendMeta?: string | null
  sentAt?: number
  failedAt?: number
  deliveredAt?: number
  readAt?: number
}

export interface WhatsAppMessageLogRow {
  id: number
  userId: number
  templateId: number
  channel: string
  direction: string
  recipient: string
  externalMessageId?: string
  status?: string
  errorCode?: string
  errorMessage?: string
  errorCategory?: string
  sendMeta?: string
  sentAt?: number
  failedAt?: number
  deliveredAt?: number
  readAt?: number
  createdAt: number
}

export async function logWhatsAppMessage(input: WhatsAppMessageLogInput): Promise<WhatsAppMessageLogRow> {
  const d1 = await getD1()
  if (!d1) throw new Error('D1 binding not available')

  const nowEpoch = Math.floor(Date.now() / 1000)

  const res = await d1
    .prepare(
      `INSERT INTO whatsapp_message_log
         (user_id, template_id, channel, direction, recipient,
          external_message_id, status, error_code, error_message,
          error_category, send_meta, sent_at, delivered_at, read_at, failed_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
       RETURNING *`,
    )
    .bind(
      input.userId,
      input.templateId,
      input.channel,
      input.direction,
      input.recipient,
      input.externalMessageId ?? null,
      input.status ?? 'pending',
      input.errorCode ?? null,
      input.errorMessage ?? null,
      input.errorCategory ?? null,
      input.sendMeta ?? null,
      input.sentAt ?? nowEpoch,
      input.deliveredAt ?? null,
      input.readAt ?? null,
      input.failedAt ?? null,
      nowEpoch,
    )
    .all<WhatsAppMessageLogRow>()

  const row = res.results?.[0]
  if (!row) {
    logger.error('[WhatsAppMsgLog] Insert returned no row', { input })
    throw new Error('Failed to insert WhatsApp message log')
  }
  return row
}

export async function updateWhatsAppMessageStatus(
  id: number,
  patch: Partial<Pick<WhatsAppMessageLogInput, 'status' | 'errorCode' | 'errorMessage' | 'errorCategory' | 'failedAt' | 'deliveredAt' | 'readAt' | 'externalMessageId'>>,
): Promise<void> {
  const d1 = await getD1()
  if (!d1) throw new Error('D1 binding not available')

  const updateMap: Record<string, string> = {
    status: 'status',
    errorCode: 'error_code',
    errorMessage: 'error_message',
    errorCategory: 'error_category',
    failedAt: 'failed_at',
    deliveredAt: 'delivered_at',
    readAt: 'read_at',
    externalMessageId: 'external_message_id',
  }

  const sets: string[] = []
  const vals: unknown[] = []

  for (const [patchKey, colName] of Object.entries(updateMap)) {
    const key = patchKey as keyof typeof patch
    if (patch[key] !== undefined) {
      sets.push(`${colName} = ?`)
      vals.push(patch[key] ?? null)
    }
  }

  if (sets.length === 0) return

  await d1
    .prepare(`UPDATE whatsapp_message_log SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals, id)
    .run()
}