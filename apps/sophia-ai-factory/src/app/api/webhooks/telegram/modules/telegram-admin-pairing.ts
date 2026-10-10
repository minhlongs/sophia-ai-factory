import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { approvePairing, listPaired, revokePairing } from '@/tree/telegram/pairing';
import { getDbOrDeadLetter } from './telegram-dead-letter';
import type { TelegramUpdate } from './telegram-types';

export async function handleAdminPairing(
  chatId: string,
  text: string,
  body: TelegramUpdate,
): Promise<NextResponse | null> {
  if (text.startsWith('/pair_approve')) {
    const code = text.replace('/pair_approve', '').trim();
    if (!code) {
      await sendTelegramMessage(chatId, 'Usage: /pair\\_approve <CODE>');
      return NextResponse.json({ ok: true });
    }
    const db = await getDbOrDeadLetter('pair_approve', `pair_approve_${code}`, body);
    if (!db) return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 503 });
    const result = await approvePairing(db, code, chatId);
    if (!result) {
      await sendTelegramMessage(chatId, 'Code not found or expired.');
      return NextResponse.json({ ok: true });
    }
    await sendTelegramMessage(chatId, `Approved. Chat \`${result.chatId}\` added.`);
    await sendTelegramMessage(result.chatId, 'You have been approved! Send /start to begin.');
    return NextResponse.json({ ok: true });
  }

  if (text === '/pair_list') {
    const db = await getDbOrDeadLetter('pair_list', `pair_list_${chatId}`, body);
    if (!db) return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 503 });
    const rows = await listPaired(db);
    if (rows.length === 0) {
      await sendTelegramMessage(chatId, 'No paired chats.');
      return NextResponse.json({ ok: true });
    }
    const lines = rows.map(
      (r) => `• \`${r.chat_id}\` ${r.first_name ?? '—'} (${r.paired_at.slice(0, 10)})`,
    );
    await sendTelegramMessage(chatId, `*Paired chats:*\n${lines.join('\n')}`);
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith('/pair_revoke')) {
    const targetId = text.replace('/pair_revoke', '').trim();
    if (!targetId) {
      await sendTelegramMessage(chatId, 'Usage: /pair\\_revoke <CHAT\\_ID>');
      return NextResponse.json({ ok: true });
    }
    const db = await getDbOrDeadLetter('pair_revoke', `pair_revoke_${targetId}`, body);
    if (!db) return NextResponse.json({ error: 'Database temporarily unavailable' }, { status: 503 });
    const removed = await revokePairing(db, targetId);
    await sendTelegramMessage(
      chatId,
      removed ? `Revoked \`${targetId}\`.` : `Chat \`${targetId}\` not found.`,
    );
    return NextResponse.json({ ok: true });
  }

  return null;
}
