import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { isAllowed, requestPairing } from '@/tree/telegram/pairing';
import { consumePairingToken } from '@/tree/telegram/pairing-token-service';
import { logger } from '@/seed/utils/logger-utility';
import { handleLeadGreeting } from '@/land/telegram-sales/qualification-service';
import { withMiddleware } from '@/tree/telegram/telegram-command-handlers';
import { getDbOrDeadLetter } from './telegram-dead-letter';
import { handleAdminPairing } from './telegram-admin-pairing';
import { dispatchTelegramCommand } from './telegram-command-dispatcher';
import type { TelegramUpdate } from './telegram-types';

const PUBLIC_COMMANDS = ['/version', '/help'] as const;

export async function processTelegramMessage(
  body: TelegramUpdate,
  adminChatId?: string,
): Promise<NextResponse> {
  const message = body.message;
  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id.toString();
  const firstName = message.chat.first_name ?? '';
  const text = message.text.trim();

  if (adminChatId && chatId === adminChatId) {
    const adminResponse = await handleAdminPairing(chatId, text, body);
    if (adminResponse) return adminResponse;
  }

  const isPublicCommand = PUBLIC_COMMANDS.some(
    (c) => text === c || text.startsWith(`${c} `),
  );

  const startArg: string | null =
    text === '/start' ? null : text.startsWith('/start ') ? text.slice(7).trim() : null;

  const isWebPairingToken = Boolean(startArg && /^[a-f0-9]{32}$/i.test(startArg));
  if (isWebPairingToken && startArg) {
    const db = await getDbOrDeadLetter('consume_pairing_token', `pairing_token_${startArg.slice(0, 50)}`, body);
    if (!db) return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 503 });
    const result = await consumePairingToken(db, startArg);
    if (result) {
      const db2 = await getDbOrDeadLetter('pairing_token_upsert', `pairing_token_upsert_${chatId}`, body);
      if (!db2) return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 503 });
      await db2.from('telegram_paired_chats').upsert({
        chat_id: chatId,
        first_name: firstName || null,
        paired_at: new Date().toISOString(),
        paired_by: result.userId,
      });
      await sendTelegramMessage(
        chatId,
        `✅ Đã kết nối! Xin chào ${firstName || 'bạn'}. Gõ /campaign để bắt đầu tạo video.\n\n` +
        `✅ Linked! Hi ${firstName || 'there'}. Type /campaign to start creating videos.`,
      );
    } else {
      await sendTelegramMessage(
        chatId,
        "❌ Mã kết nối không hợp lệ hoặc đã hết hạn. Vui lòng bấm \"Kết nối Telegram\" lại trên trang web.\n\n" +
        "❌ Pairing token is invalid or expired. Please click \"Connect Telegram\" again on the website.",
      );
    }
    return NextResponse.json({ ok: true });
  }

  const isSalesDeepLink = Boolean(
    startArg &&
    (startArg.startsWith('vid_') ||
     startArg.startsWith('ref_') ||
     startArg.startsWith('demo_') ||
     startArg.toLowerCase().includes('solo100')),
  );
  const isSalesCommand =
    text.startsWith('/demo') ||
    text.startsWith('/solo100') ||
    text.startsWith('/buy');

  const db = await getDbOrDeadLetter('dm_check', `dm_check_${chatId}`, body);
  const userIsPaired = db ? await isAllowed(db, chatId) : false;

  if (isSalesDeepLink || isSalesCommand) {
    await handleLeadGreeting(
      chatId,
      firstName,
      startArg || (isSalesCommand ? text.slice(1) : null),
      message.from?.username,
    );
    return NextResponse.json({ ok: true });
  }

  if (text === '/start' && !userIsPaired && chatId !== adminChatId) {
    await handleLeadGreeting(chatId, firstName, null, message.from?.username);
    return NextResponse.json({ ok: true });
  }

  if (adminChatId && chatId !== adminChatId && !isPublicCommand && !userIsPaired) {
    if (!db) {
      logger.error('[telegram-webhook] Cannot request pairing: database unavailable', { chatId });
      return NextResponse.json(
        { error: 'Database temporarily unavailable' },
        { status: 503 },
      );
    }
    const { code } = await requestPairing(db, chatId, firstName);
    await sendTelegramMessage(
      chatId,
      `Hi! To use Sophia bot, ask the admin to approve you.\n\nYour pairing code: \`${code}\`\n\n_Code expires in 15 minutes._\n\nMeanwhile you can run: /version, /help.`,
    );
    return NextResponse.json({ ok: true });
  }

  await withMiddleware(chatId, async () => {
    await dispatchTelegramCommand(chatId, text);
  });

  return NextResponse.json({ ok: true });
}
