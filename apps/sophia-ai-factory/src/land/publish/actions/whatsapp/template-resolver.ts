import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import {
  type ApprovalRow,
  ScheduleWhatsAppError,
  ApproveWhatsAppError,
} from './types';

export function newJobId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if the user has approved WhatsApp outbound sends.
 * Queries the whatsapp_approved flag on their whatsapp_templates row.
 */
export async function checkApprovalStatus(userId: string): Promise<Result<boolean>> {
  const db = await getD1();
  if (!db) return failure(new ScheduleWhatsAppError('D1_UNAVAILABLE', 'D1 not available'));

  const row = await db
    .prepare(
      `SELECT whatsapp_approved FROM whatsapp_templates
       WHERE user_id = ?1 ORDER BY is_default DESC LIMIT 1`,
    )
    .bind(userId)
    .first<ApprovalRow>();

  if (!row) return success(false);
  return success(row.whatsapp_approved === 1);
}

/**
 * Mark the user as having approved WhatsApp outbound sends.
 * Updates all whatsapp_templates rows for the user.
 */
export async function setApprovalStatus(userId: string): Promise<Result<void>> {
  const db = await getD1();
  if (!db) return failure(new ApproveWhatsAppError('D1_UNAVAILABLE', 'D1 not available'));

  const result = await db
    .prepare(
      `UPDATE whatsapp_templates SET whatsapp_approved = 1
       WHERE user_id = ?1`,
    )
    .bind(userId)
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return failure(
      new ApproveWhatsAppError(
        'NO_WHATSAPP_CREDENTIALS',
        'No WhatsApp credentials found for this user',
      ),
    );
  }

  logger.info('[WhatsAppPublish] User approved WhatsApp sends', { userId });
  return success(undefined);
}
