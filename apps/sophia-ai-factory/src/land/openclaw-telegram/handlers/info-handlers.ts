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

export const NOT_PAIRED_MSG =
  '⚠️ Bạn chưa liên kết tài khoản. Mở https://sophia.agencyos.network/dashboard/settings → "Connect Telegram" để pair.\n\n' +
  '⚠️ Your account is not linked yet. Visit the dashboard → "Connect Telegram" to pair.';

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
  const pctH = q.percentages.hourly;
  const pctD = q.percentages.daily;
  const pctM = q.percentages.monthly;
  await sendMessage(
    chatId,
    `📊 *Quota — tier ${q.tier}*\n` +
      `• Giờ: ${q.usage.hourly}/${q.limits.hourlyCredits} (${pctH}%)\n` +
      `• Ngày: ${q.usage.daily}/${q.limits.dailyCredits} (${pctD}%)\n` +
      `• Tháng: ${q.usage.monthly}/${q.limits.monthlyCredits} (${pctM}%)\n` +
      `• Requests hôm nay: ${q.usage.requests}/${q.limits.dailyRequests}\n` +
      `• Status: \`${q.status}\``,
  );
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
  const fmt = (sec: number | null): string =>
    sec ? new Date(sec * 1000).toISOString().slice(0, 10) : '—';
  await sendMessage(
    chatId,
    `🔖 *Handover*\n` +
      `• Agency: ${h.agencyName ?? '—'}\n` +
      `• Tier: \`${h.tier ?? '—'}\`\n` +
      `• Status: \`${h.status ?? '—'}\`\n` +
      `• First login: ${fmt(h.firstLoginAt)}\n` +
      `• First SOP install: ${fmt(h.firstSopInstallAt)}\n` +
      `• First run: ${fmt(h.firstRunAt)}`,
  );
}
