import { sendMessage } from '@/tree/telegram/handlers/utils';
import {
  resolveUserIdFromChat,
  callGetVersion,
  callGetTier,
  callGetQuota,
  callGetAffiliateStats,
  callGetVideoStatus,
  callGetHandover,
} from '@/land/openclaw-telegram/openclaw-bridge';
import {
  NOT_PAIRED_MSG,
  formatQuotaReply,
  formatHandoverReply,
} from './info-handler-formatters';

export { NOT_PAIRED_MSG };

/** /version — public, returns deploy SHA + timestamp. */
export async function handleVersion(chatId: string): Promise<void> {
  const v = callGetVersion();
  await sendMessage(
    chatId,
    `🟢 *Sophia version*\n• SHA: \`${v.shortSha}\`\n• Deployed at: ${v.deployedAt}`,
  );
}

/** /tier — paired user only. Returns current tier + display name. */
export async function handleTier(chatId: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const info = await callGetTier(userId);
  if (!info) {
    await sendMessage(chatId, '❌ Không tìm thấy tài khoản tương ứng. Hãy thử /pair_request.');
    return;
  }
  await sendMessage(
    chatId,
    `👤 *Tài khoản của bạn*\n• Email: \`${info.email}\`\n• Tên: ${info.displayName || '_chưa đặt_'}\n• Tier: *${info.tier}*\n• Locale: \`${info.locale}\``,
  );
}

/** /quota — paired user only. Returns usage vs limits. */
export async function handleQuota(chatId: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const q = await callGetQuota(userId);
  await sendMessage(chatId, formatQuotaReply(q));
}

/** /affiliate — paired user only. Shows last 5 conversions + total count. */
export async function handleAffiliate(chatId: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const stats = await callGetAffiliateStats(userId);
  if (stats.count === 0) {
    await sendMessage(
      chatId,
      '💼 *Affiliate*\n_Chưa có conversion nào._\n\nLog vào dashboard → Affiliate để tạo link đầu tiên.',
    );
    return;
  }
  const lines = stats.conversions
    .slice(0, 5)
    .map(
      (c: { conversionId: string; commissionUsd: number; status: string }) =>
        `• \`${c.conversionId.slice(0, 8)}\` — $${c.commissionUsd.toFixed(2)} (${c.status})`,
    );
  await sendMessage(
    chatId,
    `💼 *Affiliate* — ${stats.count} conversion(s)\n${lines.join('\n')}`,
  );
}

/**
 * /videos [status] — paired user only.
 * Optional filter: `processing` | `completed` | `failed`.
 */
export async function handleVideos(chatId: string, statusFilter?: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const list = await callGetVideoStatus(userId, statusFilter);
  if (list.count === 0) {
    const filterTag = statusFilter ? ` (filter: \`${statusFilter}\`)` : '';
    await sendMessage(chatId, `🎬 *Videos*${filterTag}\n_Chưa có video nào._`);
    return;
  }
  const lines = list.videos.map(
    (v: { id: string; title: string | null; status: string }) => `• \`${v.id.slice(0, 8)}\` — ${v.title ?? 'Untitled'} _(${v.status})_`,
  );
  await sendMessage(chatId, `🎬 *Videos* — ${list.count} kết quả\n${lines.join('\n')}`);
}

/** /handover — paired user only. Returns onboarding milestones. */
export async function handleHandover(chatId: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const h = await callGetHandover(userId);
  if (!h) {
    await sendMessage(chatId, '🔖 *Handover*\n_Chưa có bản handover nào cho user này._');
    return;
  }
  await sendMessage(chatId, formatHandoverReply(h));
}
