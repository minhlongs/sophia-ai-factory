/**
 * Telegram command handlers mirroring the 7 OpenClaw plugin tools.
 *
 * Each handler:
 *   1. Resolves the paired user_id (when authenticated tool).
 *   2. Calls the in-process bridge function (no HTTP loopback).
 *   3. Formats a Markdown reply suitable for Telegram.
 *
 * Commands surfaced:
 *   /version         → sophia_get_version       (public, no pairing required)
 *   /tier            → sophia_get_tier
 *   /quota           → sophia_get_quota
 *   /affiliate       → sophia_get_affiliate_stats
 *   /videos          → sophia_get_video_status (optional state arg)
 *   /handover        → sophia_get_handover
 *   /free100 <email> → sophia_redeem_free100   (public, mints magic link)
 *
 * @module tree/telegram/handlers/openclaw-handlers
 */
import { sendMessage } from '@/tree/telegram/handlers/utils';
import {
  resolveUserIdFromChat,
  callGetVersion,
  callGetTier,
  callGetQuota,
  callGetAffiliateStats,
  callGetVideoStatus,
  callGetHandover,
  callRedeemFree100,
  callEmbedAffiliateInDescription,
  callTranslateScript,
  callCloneVoice,
} from '@/land/openclaw-telegram/openclaw-bridge';

const NOT_PAIRED_MSG =
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
      (c) =>
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
    (v) => `• \`${v.id.slice(0, 8)}\` — ${v.title ?? 'Untitled'} _(${v.status})_`,
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

/**
 * /embed <videoId|"sample body text"> — paired user only.
 * Builds an enriched video description by injecting the user's affiliate
 * links. If the arg looks like a 16-32-char hex/uuid it's treated as a
 * videoId; otherwise it is used directly as the body text.
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
  // Reply preserves the description verbatim inside a fenced block so the
  // user can copy-paste it straight into YouTube / TikTok / etc.
  await sendMessage(
    chatId,
    `🔗 *Affiliate-embedded description* (${result.affiliateCount} link${result.affiliateCount === 1 ? '' : 's'}):\n\n\`\`\`\n${result.description}\n\`\`\``,
  );
}

/**
 * /translate <toLang> <text> — paired user only.
 * Uses the user's BYOK OpenRouter key to translate `text` to `toLang`.
 * Source language is auto-detected by the LLM. Example:
 *   /translate vi Hello world from Vietnam
 */
export async function handleTranslate(chatId: string, rawArg: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const arg = rawArg.trim();
  const firstSpace = arg.indexOf(' ');
  if (firstSpace < 2) {
    await sendMessage(
      chatId,
      '❌ Cú pháp: `/translate <toLang> <text>` — ví dụ: `/translate vi Hello world`',
    );
    return;
  }
  const toLang = arg.slice(0, firstSpace).trim();
  const text = arg.slice(firstSpace + 1).trim();
  if (text.length === 0) {
    await sendMessage(chatId, '❌ Text bị trống — đính kèm nội dung cần dịch sau ngôn ngữ đích.');
    return;
  }
  const out = await callTranslateScript({
    userId,
    text,
    fromLang: 'auto',
    toLang,
  });
  if (!out.ok) {
    if (out.code === 'BYOK_REQUIRED') {
      await sendMessage(
        chatId,
        '🔑 *Cần OpenRouter key*\nVào /dashboard/setup-wizard và nhập key OpenRouter của bạn để dùng /translate.',
      );
      return;
    }
    await sendMessage(chatId, `❌ Translate thất bại: \`${out.message}\``);
    return;
  }
  await sendMessage(
    chatId,
    `🌐 *Translated → ${toLang}* (model \`${out.result.model.split('/').pop()}\`)\n\n\`\`\`\n${out.result.translated}\n\`\`\``,
  );
}

/**
 * /clone-voice <name>|<audioUrl1>[,audioUrl2,...] — paired user only.
 * Uses the user's BYOK ElevenLabs key to register a cloned voice.
 * Pipe (`|`) separates the name from the comma-separated audio URLs.
 */
export async function handleCloneVoice(chatId: string, rawArg: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const arg = rawArg.trim();
  const pipe = arg.indexOf('|');
  if (pipe < 1) {
    await sendMessage(
      chatId,
      '❌ Cú pháp: `/clone-voice <Name>|<url1>[,url2,...]` — ví dụ: `/clone-voice Tho|https://r2.example/sample.mp3`',
    );
    return;
  }
  const name = arg.slice(0, pipe).trim();
  const audioUrls = arg
    .slice(pipe + 1)
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  if (audioUrls.length === 0) {
    await sendMessage(chatId, '❌ Cần ít nhất một URL audio sau dấu `|`.');
    return;
  }
  const out = await callCloneVoice({ userId, name, audioUrls });
  if (!out.ok) {
    if (out.code === 'BYOK_REQUIRED') {
      await sendMessage(
        chatId,
        '🔑 *Cần ElevenLabs key*\nVào /dashboard/setup-wizard và nhập key ElevenLabs để dùng /clone-voice.',
      );
      return;
    }
    await sendMessage(chatId, `❌ Clone voice thất bại (\`${out.code}\`): ${out.message}`);
    return;
  }
  await sendMessage(
    chatId,
    `🎙️ *Voice cloned*\n• Name: ${out.result.name}\n• Voice ID: \`${out.result.voiceId}\`\n• Samples: ${out.result.samplesUploaded}\n\nDùng voice_id này cho /video TTS calls.`,
  );
}

/** /free100 <email> — public, mints a magic link for the supplied email. */
export async function handleFree100(chatId: string, rawArg: string): Promise<void> {
  const email = rawArg.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
