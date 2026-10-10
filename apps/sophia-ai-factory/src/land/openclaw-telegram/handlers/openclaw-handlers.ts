import { sendMessage } from '@/tree/telegram/handlers/utils';
import {
  resolveUserIdFromChat,
  callRedeemFree100,
  callEmbedAffiliateInDescription,
} from '@/land/openclaw-telegram/openclaw-bridge';
import { parseFree100Email } from './command-parser';
import { NOT_PAIRED_MSG } from './info-handlers';

export * from './info-handlers';
export * from './ai-handlers';

/**
 * /embed <videoId|"sample body text"> — paired user only.
 */
export async function handleEmbed(chatId: string, rawArg: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const arg = rawArg.trim();
  const looksLikeId = /^[0-9a-f-]{16,40}$/i.test(arg);
  const result = await callEmbedAffiliateInDescription({
    userId,
    ...(looksLikeId ? { videoId: arg } : { baseBody: arg || 'Watch the latest video on our channel.' }),
  });
  if (result.affiliateCount === 0) {
    await sendMessage(
      chatId,
      '📭 *No affiliate links yet*\nVisit /dashboard/affiliate to create your first tracked link, then run /embed again.',
    );
    return;
  }
  await sendMessage(
    chatId,
    `🔗 *Affiliate-embedded description* (${result.affiliateCount} link${result.affiliateCount === 1 ? '' : 's'}):\n\n\`\`\`\n${result.description}\n\`\`\``,
  );
}

/** /free100 <email> — paired chats only; mints a magic link for the supplied email. */
export async function handleFree100(chatId: string, rawArg: string): Promise<void> {
  const email = parseFree100Email(rawArg);
  if (!email) {
    await sendMessage(
      chatId,
      '❌ Cú pháp: `/free100 <email>` — ví dụ: `/free100 you@example.com`',
    );
    return;
  }
  const result = await callRedeemFree100({ code: 'FREE100', email, tier: 'MASTER' });
  if (!result.success) {
    await sendMessage(chatId, `❌ Redeem thất bại: \`${result.error ?? 'unknown_error'}\``);
    return;
  }
  if (result.magicLink) {
    await sendMessage(
      chatId,
      `🎉 *FREE100 đã kích hoạt!*\n\n[Vào Dashboard ngay](${result.magicLink})\n\n_Link có hiệu lực 72h, single-use._`,
    );
  } else {
    await sendMessage(
      chatId,
      `✅ Đã redeem (handover \`${result.handoverId ?? '—'}\`). Email magic-link đang được gửi.`,
    );
  }
}
