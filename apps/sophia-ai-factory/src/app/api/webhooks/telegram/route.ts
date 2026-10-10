export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  handleCallbackQuery,
  withMiddleware,
} from '@/tree/telegram/telegram-command-handlers';
import { handleOfferCallback } from '@/tree/telegram/telegram-bot-campaign-handlers';
import { handleQualificationCallback } from '@/land/telegram-sales/qualification-service';
import {
  type TelegramUpdate,
  processTelegramMessage,
} from './modules';

export async function POST(request: NextRequest) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    const { logger } = await import('@/seed/utils/logger-utility');
    logger.warn('[telegram-webhook] TELEGRAM_BOT_TOKEN is not set — bot is dormant');
    return NextResponse.json({ ok: true });
  }

  let body: TelegramUpdate;
  try {
    body = (await request.json().catch(() => ({}))) as TelegramUpdate;
  } catch {
    body = {} as TelegramUpdate;
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    const { logger } = await import('@/seed/utils/logger-utility');
    logger.error('[telegram-webhook] TELEGRAM_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }
  const token = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (token !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (body.callback_query) {
      const chatId = body.callback_query.message?.chat?.id?.toString();
      const callbackData = body.callback_query.data;

      if (chatId && callbackData) {
        if (
          callbackData.startsWith('lead_') ||
          callbackData.startsWith('checkout_pay:')
        ) {
          await handleQualificationCallback(chatId, callbackData);
          return NextResponse.json({ ok: true });
        }

        if (callbackData.startsWith('offer_')) {
          await handleOfferCallback(chatId, callbackData);
          return NextResponse.json({ ok: true });
        }
        await withMiddleware(chatId, () => handleCallbackQuery(chatId, callbackData));
      }
      return NextResponse.json({ ok: true });
    }

    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    return await processTelegramMessage(body, adminChatId);
  } catch (error) {
    const { logger } = await import('@/seed/utils/logger-utility');
    logger.error('[telegram-webhook] Unhandled error', { error: String(error) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
