/**
 * WhatsApp Business Cloud API Adapter Helpers
 *
 * @module land/video/publishing/providers/whatsapp-adapter-helpers
 */

import type { PublishMeta } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { FailureKind } from '@/seed/types/failure-kind';
import { logWhatsAppMessage } from '@/tree/credentials/whatsapp-message-logger';

export const GRAPH_API_VERSION = 'v19.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
export const TEMPLATE_NAME = 'sophia_template';
export const LANGUAGE = 'vi';

export function isWhatsAppMockMode(): boolean {
  return !process.env.INSTAGRAM_APP_ID;
}

export function inferWhatsAppRecipient(meta: PublishMeta): string {
  if ('targetId' in meta && typeof meta.targetId === 'string' && meta.targetId) {
    return meta.targetId;
  }
  return '';
}

export function extractWhatsAppMessageId(text: string): string | null {
  try {
    const data = JSON.parse(text);
    return (
      data.entries?.[0]?.changes?.value?.messages?.[0]?.id ??
      data?.messages?.[0]?.id ??
      null
    );
  } catch {
    return null;
  }
}

export function buildWhatsAppMockId(suffix: string): string {
  return `mock_whatsapp_${suffix}_${Date.now()}`;
}

export function classifyWhatsAppStatus(status: number): FailureKind {
  if (status === 401 || status === 403) return FailureKind.AUTH_FAILURE;
  if (status === 429) return FailureKind.RATE_LIMIT;
  return FailureKind.SERVER_ERROR;
}

export async function persistWhatsAppLog(
  input: Parameters<typeof logWhatsAppMessage>[0],
): Promise<void> {
  try {
    await logWhatsAppMessage(input);
  } catch (err) {
    logger.warn('[WhatsApp] message log write failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
