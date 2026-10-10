import { sendMessage } from '@/tree/telegram/handlers/utils';
import {
  resolveUserIdFromChat,
  callTranslateScript,
  callCloneVoice,
  callGenerateSeoScript,
  callSchedulePublish,
} from '@/land/openclaw-telegram/openclaw-bridge';
import {
  parseTranslateArg,
  parseCloneVoiceArg,
  parseSeoScriptArg,
  parsePublishArg,
} from './command-parser';
import { NOT_PAIRED_MSG } from './info-handlers';

/**
 * /translate <toLang> <text> — paired user only.
 */
export async function handleTranslate(chatId: string, rawArg: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const parsed = parseTranslateArg(rawArg);
  if (!parsed) {
    await sendMessage(
      chatId,
      '❌ Cú pháp: `/translate <toLang> <text>` — ví dụ: `/translate vi Hello world`',
    );
    return;
  }
  const out = await callTranslateScript({
    userId,
    text: parsed.text,
    fromLang: 'auto',
    toLang: parsed.toLang,
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
    `🌐 *Translated → ${parsed.toLang}* (model \`${out.result.model.split('/').pop()}\`)\n\n\`\`\`\n${out.result.translated}\n\`\`\``,
  );
}

/**
 * /clone-voice <name>|<audioUrl1>[,audioUrl2,...] — paired user only.
 */
export async function handleCloneVoice(chatId: string, rawArg: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const parsed = parseCloneVoiceArg(rawArg);
  if (!parsed) {
    await sendMessage(
      chatId,
      '❌ Cú pháp: `/clone-voice <Name>|<url1>[,url2,...]` — ví dụ: `/clone-voice Tho|https://r2.example/sample.mp3`',
    );
    return;
  }
  const out = await callCloneVoice({ userId, name: parsed.name, audioUrls: parsed.audioUrls });
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

/**
 * /seo-script <topic> [| kw1, kw2, ...] — paired user only.
 */
export async function handleSeoScript(chatId: string, rawArg: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const parsed = parseSeoScriptArg(rawArg);
  if (!parsed) {
    await sendMessage(
      chatId,
      '❌ Cú pháp: `/seo-script <topic> [| kw1, kw2]` — ví dụ: `/seo-script affiliate marketing | passive income, byok`',
    );
    return;
  }
  const out = await callGenerateSeoScript({ userId, topic: parsed.topic, keywords: parsed.keywords });
  if (!out.ok) {
    if (out.code === 'BYOK_REQUIRED') {
      await sendMessage(
        chatId,
        '🔑 *Cần OpenRouter key*\nVào /dashboard/setup-wizard và nhập key OpenRouter để dùng /seo-script.',
      );
      return;
    }
    await sendMessage(chatId, `❌ SEO script thất bại (\`${out.code}\`): ${out.message}`);
    return;
  }
  const coverageLine = out.result.keywordCoverage
    .map((c: { keyword: string; hits: number }) => `${c.keyword} ×${c.hits}`)
    .join(', ');
  await sendMessage(
    chatId,
    `🧠 *SEO Script* — score ${out.result.seoScore}/100 (${out.result.wordCount} words)\n` +
      (coverageLine ? `_Coverage:_ ${coverageLine}\n` : '') +
      `\`\`\`\n${out.result.script}\n\`\`\`\n` +
      `📝 _Title ideas:_\n${out.result.suggestedTitles.map((t: string) => `• ${t}`).join('\n')}`,
  );
}

/**
 * /publish <videoId> <channelId> <ISO_DATE> [caption] — paired user only.
 */
export async function handleSchedulePublish(chatId: string, rawArg: string): Promise<void> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) {
    await sendMessage(chatId, NOT_PAIRED_MSG);
    return;
  }
  const { parsed, error } = parsePublishArg(rawArg);
  if (!parsed) {
    if (error?.startsWith('invalid_date:')) {
      await sendMessage(chatId, `❌ ISO date không hợp lệ: \`${error.replace('invalid_date:', '')}\``);
      return;
    }
    await sendMessage(
      chatId,
      '❌ Cú pháp: `/publish <videoId> <channelId> <ISO_DATE> [caption]`\nVí dụ: `/publish v_abc c_yt 2026-06-01T09:00:00Z Launch day`',
    );
    return;
  }
  const out = await callSchedulePublish({
    userId,
    videoId: parsed.videoId,
    channelId: parsed.channelId,
    scheduledAt: parsed.scheduledAt,
    caption: parsed.caption,
  });
  if (!out.ok) {
    await sendMessage(chatId, `❌ Schedule thất bại (\`${out.code}\`): ${out.message}`);
    return;
  }
  await sendMessage(
    chatId,
    `📅 *Đã xếp lịch publish*\n• Job: \`${out.result.jobId}\`\n• Scheduled: ${new Date(out.result.scheduledAt * 1000).toISOString()}\n• Status: \`${out.result.status}\``,
  );
}
