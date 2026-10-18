/**
 * Telegram Markdown formatters for OpenClaw info commands.
 * @module land/openclaw-telegram/handlers/info-handler-formatters
 */

export const NOT_PAIRED_MSG =
  '⚠️ Bạn chưa liên kết tài khoản. Mở https://sophia.agencyos.network/dashboard/settings → "Connect Telegram" để pair.\n\n' +
  '⚠️ Your account is not linked yet. Visit the dashboard → "Connect Telegram" to pair.';

export function formatQuotaReply(q: {
  tier: string;
  usage: { hourly: number; daily: number; monthly: number; requests: number };
  limits: {
    hourlyCredits: number;
    dailyCredits: number;
    monthlyCredits: number;
    dailyRequests: number;
  };
  percentages: { hourly: number; daily: number; monthly: number };
  status: string;
}): string {
  const pctH = q.percentages.hourly;
  const pctD = q.percentages.daily;
  const pctM = q.percentages.monthly;
  return (
    `📊 *Quota — tier ${q.tier}*\n` +
    `• Giờ: ${q.usage.hourly}/${q.limits.hourlyCredits} (${pctH}%)\n` +
    `• Ngày: ${q.usage.daily}/${q.limits.dailyCredits} (${pctD}%)\n` +
    `• Tháng: ${q.usage.monthly}/${q.limits.monthlyCredits} (${pctM}%)\n` +
    `• Requests hôm nay: ${q.usage.requests}/${q.limits.dailyRequests}\n` +
    `• Status: \`${q.status}\``
  );
}

export function formatHandoverReply(h: {
  agencyName: string | null;
  tier: string | null;
  status: string | null;
  firstLoginAt: number | null;
  firstSopInstallAt: number | null;
  firstRunAt: number | null;
}): string {
  const fmt = (sec: number | null): string =>
    sec ? new Date(sec * 1000).toISOString().slice(0, 10) : '—';
  return (
    `🔖 *Handover*\n` +
    `• Agency: ${h.agencyName ?? '—'}\n` +
    `• Tier: \`${h.tier ?? '—'}\`\n` +
    `• Status: \`${h.status ?? '—'}\`\n` +
    `• First login: ${fmt(h.firstLoginAt)}\n` +
    `• First SOP install: ${fmt(h.firstSopInstallAt)}\n` +
    `• First run: ${fmt(h.firstRunAt)}`
  );
}
