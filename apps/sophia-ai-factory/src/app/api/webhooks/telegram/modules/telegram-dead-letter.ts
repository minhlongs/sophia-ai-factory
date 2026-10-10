import { tryCreateServerClient } from '@/seed/db/client';
import { writeDeadLetterToR2, generateDeadLetterKey } from '@/seed/r2/bucket-ops';
import { logger } from '@/seed/utils/logger-utility';
import type { TelegramUpdate } from './telegram-types';

export async function getDbOrDeadLetter(
  operation: string,
  eventId: string,
  body: TelegramUpdate,
): Promise<ReturnType<typeof tryCreateServerClient>> {
  const db = tryCreateServerClient();
  if (!db) {
    await writeDeadLetterToR2(generateDeadLetterKey('telegram', eventId), {
      webhookType: 'telegram',
      operation,
      timestamp: new Date().toISOString(),
      payload: body,
      error: 'D1 binding unavailable',
    });
    logger.error('[telegram-webhook] D1 unavailable — dead-letter written', { operation, eventId });
  }
  return db;
}
