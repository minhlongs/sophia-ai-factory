/**
 * WhatsApp Publish types, schema, and approval gate operations.
 * @module land/publish/api/whatsapp-publish-approval
 */

import { z } from 'zod';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';

export const whatsappPublishSchema = z.object({
  videoId: z.string().min(1, 'videoId is required'),
  target: z.string().regex(/^\+?\d{10,15}$/, 'target must be E.164 phone number'),
  templateId: z.number().int().positive('templateId must be a positive integer'),
});
export type WhatsAppPublishInput = z.infer<typeof whatsappPublishSchema>;

export interface WhatsAppPublishResult {
  jobId: string;
  status: 'scheduled' | 'pending_approval';
  error?: string;
}

export type PublishErrorCode =
  | 'UNAUTHENTICATED' | 'VIDEO_NOT_FOUND' | 'FORBIDDEN' | 'NOT_APPROVED'
  | 'NO_WHATSAPP_CREDENTIALS' | 'INSERT_FAILED'
  | 'INVALID_INPUT' | 'D1_UNAVAILABLE';

export class WhatsAppPublishError extends Error {
  code: PublishErrorCode;
  constructor(code: PublishErrorCode, message: string) {
    super(message);
    this.name = 'WhatsAppPublishError';
    this.code = code;
  }
}

interface ApprovalRow { whatsapp_approved: number }

export function newJobId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if the user has approved WhatsApp outbound sends.
 */
export async function checkApprovalStatus(userId: string): Promise<Result<boolean>> {
  const db = await getD1();
  if (!db) return failure(new WhatsAppPublishError('D1_UNAVAILABLE', 'D1 not available'));
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
 */
export async function approveWhatsappSend(userId: string): Promise<Result<void>> {
  const db = await getD1();
  if (!db) return failure(new WhatsAppPublishError('D1_UNAVAILABLE', 'D1 not available'));
  const result = await db
    .prepare(`UPDATE whatsapp_templates SET whatsapp_approved = 1 WHERE user_id = ?1`)
    .bind(userId)
    .run();
  if ((result.meta?.changes ?? 0) === 0) {
    return failure(
      new WhatsAppPublishError('NO_WHATSAPP_CREDENTIALS', 'No WhatsApp credentials found for this user'),
    );
  }
  logger.info('[WhatsAppPublish] User approved WhatsApp sends', { userId });
  return success(undefined);
}
