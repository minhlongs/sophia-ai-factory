/**
 * AI Command Message Formatters for OpenClaw Telegram Bridge
 * Layer: land/openclaw-telegram/handlers
 */

export const TRANSLATE_SYNTAX_MSG =
  '❌ Cú pháp: `/translate <toLang> <text>` — ví dụ: `/translate vi Hello world`';
export const TRANSLATE_BYOK_MSG =
  '🔑 *Cần OpenRouter key*\nVào /dashboard/setup-wizard và nhập key OpenRouter của bạn để dùng /translate.';

export const CLONE_VOICE_SYNTAX_MSG =
  '❌ Cú pháp: `/clone-voice <Name>|<url1>[,url2,...]` — ví dụ: `/clone-voice Tho|https://r2.example/sample.mp3`';
export const CLONE_VOICE_BYOK_MSG =
  '🔑 *Cần ElevenLabs key*\nVào /dashboard/setup-wizard và nhập key ElevenLabs để dùng /clone-voice.';

export const SEO_SCRIPT_SYNTAX_MSG =
  '❌ Cú pháp: `/seo-script <topic> [| kw1, kw2]` — ví dụ: `/seo-script affiliate marketing | passive income, byok`';
export const SEO_SCRIPT_BYOK_MSG =
  '🔑 *Cần OpenRouter key*\nVào /dashboard/setup-wizard và nhập key OpenRouter để dùng /seo-script.';

export const PUBLISH_SYNTAX_MSG =
  '❌ Cú pháp: `/publish <videoId> <channelId> <ISO_DATE> [caption]`\nVí dụ: `/publish v_abc c_yt 2026-06-01T09:00:00Z Launch day`';

export function formatSeoScriptSuccessMsg(result: {
  seoScore: number;
  wordCount: number;
  keywordCoverage: Array<{ keyword: string; hits: number }>;
  script: string;
  suggestedTitles: string[];
}): string {
  const coverageLine = result.keywordCoverage
    .map((c) => `${c.keyword} ×${c.hits}`)
    .join(', ');
  return (
    `🧠 *SEO Script* — score ${result.seoScore}/100 (${result.wordCount} words)\n` +
    (coverageLine ? `_Coverage:_ ${coverageLine}\n` : '') +
    `\`\`\`\n${result.script}\n\`\`\`\n` +
    `📝 _Title ideas:_\n${result.suggestedTitles.map((t) => `• ${t}`).join('\n')}`
  );
}

export function formatPublishSuccessMsg(result: {
  jobId: string;
  scheduledAt: number;
  status: string;
}): string {
  return `📅 *Đã xếp lịch publish*\n• Job: \`${result.jobId}\`\n• Scheduled: ${new Date(result.scheduledAt * 1000).toISOString()}\n• Status: \`${result.status}\``;
}
