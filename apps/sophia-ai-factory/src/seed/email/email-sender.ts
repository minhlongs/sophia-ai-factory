/**
 * Seed Email Sender Registry & Interface
 *
 * Provides a decoupling interface for the seed layer (e.g. Better Auth)
 * to send transactional emails without directly importing upper layers
 * (@/tree/email/sender).
 *
 * Upper layers (tree) register the concrete email sender at startup or import time.
 * If no sender is registered, logs a warning and falls back safely.
 *
 * @module seed/email/email-sender
 */

import { logger } from '@/seed/utils/logger-utility';

export interface SeedEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export type SeedEmailSender = (params: SeedEmailParams) => Promise<{ success: boolean; messageId?: string; error?: string }>;

let globalEmailSender: SeedEmailSender | null = null;

/**
 * Register the concrete email sender implementation (called from tree layer).
 */
export function registerEmailSender(sender: SeedEmailSender): void {
  globalEmailSender = sender;
}

/**
 * Send an email through the registered sender.
 * Safe fallback if no sender is registered.
 */
export async function sendSeedEmail(params: SeedEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (globalEmailSender) {
    try {
      return await globalEmailSender(params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[seed/email] Failed to send email via registered sender', {
        to: params.to,
        subject: params.subject,
        error: msg,
      });
      return { success: false, error: msg };
    }
  }

  logger.info('[seed/email] No email sender registered, falling back to dry-run log', {
    to: params.to,
    subject: params.subject,
  });
  return { success: true, messageId: 'dry-run-seed' };
}
