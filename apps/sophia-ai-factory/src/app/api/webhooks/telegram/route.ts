export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  handleCallbackQuery,
  withMiddleware,
} from '@/tree/telegram/telegram-command-handlers';
import { handleOfferCallback } from '@/tree/telegram/telegram-bot-campaign-handlers';
import { handleTelegramCampaignApprovalCallback } from '@/tree/telegram/telegram-campaign-approval-handler';
import { handleQualificationCallback } from '@/land/telegram-sales/qualification-service';
import {
  type TelegramUpdate,
  processTelegramMessage,
} from './modules';

/**
 * Routes a CEO campaign-approval inline callback (`capprove:` / `creject:`)
 * to the tenant-scoped handler, logging any rejected decision without
 * surfacing internal error detail to the chat.
 */
async function dispatchCampaignApprovalCallback(
  chatId: string,
  callbackData: string,
): Promise<void> {
  const { logger } = await import('@/seed/utils/logger-utility');
  const result = await handleTelegramCampaignApprovalCallback(chatId, callbackData);
  if (!result.ok) {
    logger.warn('[telegram-webhook] Campaign approval callback rejected', {
      chatId,
      action: result.action,
      approvalId: result.approvalId,
      reason: result.reason,
    });
  }
}

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

        if (
          callbackData.startsWith('capprove:') ||
          callbackData.startsWith('creject:')
        ) {
          await dispatchCampaignApprovalCallback(chatId, callbackData);
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
