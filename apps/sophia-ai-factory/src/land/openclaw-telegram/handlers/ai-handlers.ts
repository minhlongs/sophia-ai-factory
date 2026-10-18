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
import {
  CLONE_VOICE_BYOK_MSG,
  CLONE_VOICE_SYNTAX_MSG,
  PUBLISH_SYNTAX_MSG,
  SEO_SCRIPT_BYOK_MSG,
  SEO_SCRIPT_SYNTAX_MSG,
  TRANSLATE_BYOK_MSG,
  TRANSLATE_SYNTAX_MSG,
  formatPublishSuccessMsg,
  formatSeoScriptSuccessMsg,
} from './ai-handler-messages';

async function requirePairedUser(chatId: string): Promise<string | null> {
  const userId = await resolveUserIdFromChat(chatId);
  if (!userId) await sendMessage(chatId, NOT_PAIRED_MSG);
  return userId;
}

export async function handleTranslate(chatId: string, rawArg: string): Promise<void> {
  const userId = await requirePairedUser(chatId);
  if (!userId) return;
  const parsed = parseTranslateArg(rawArg);
  if (!parsed) {
    await sendMessage(chatId, TRANSLATE_SYNTAX_MSG);
    return;
  }
  const out = await callTranslateScript({
    userId,
    text: parsed.text,
    fromLang: 'auto',
    toLang: parsed.toLang,
  });
  if (!out.ok) {
    await sendMessage(
      chatId,
      out.code === 'BYOK_REQUIRED' ? TRANSLATE_BYOK_MSG : `❌ Translate thất bại: \`${out.message}\``,
    );
    return;
  }
  await sendMessage(
    chatId,
    `🌐 *Translated → ${parsed.toLang}* (model \`${out.result.model.split('/').pop()}\`)\n\n\`\`\`\n${out.result.translated}\n\`\`\``,
  );
}

export async function handleCloneVoice(chatId: string, rawArg: string): Promise<void> {
  const userId = await requirePairedUser(chatId);
  if (!userId) return;
  const parsed = parseCloneVoiceArg(rawArg);
  if (!parsed) {
    await sendMessage(chatId, CLONE_VOICE_SYNTAX_MSG);
    return;
  }
  const out = await callCloneVoice({ userId, name: parsed.name, audioUrls: parsed.audioUrls });
  if (!out.ok) {
    await sendMessage(
      chatId,
      out.code === 'BYOK_REQUIRED'
        ? CLONE_VOICE_BYOK_MSG
        : `❌ Clone voice thất bại (\`${out.code}\`): ${out.message}`,
    );
    return;
  }
  await sendMessage(
    chatId,
    `🎙️ *Voice cloned*\n• Name: ${out.result.name}\n• Voice ID: \`${out.result.voiceId}\`\n• Samples: ${out.result.samplesUploaded}\n\nDùng voice_id này cho /video TTS calls.`,
  );
}

export async function handleSeoScript(chatId: string, rawArg: string): Promise<void> {
  const userId = await requirePairedUser(chatId);
  if (!userId) return;
  const parsed = parseSeoScriptArg(rawArg);
  if (!parsed) {
    await sendMessage(chatId, SEO_SCRIPT_SYNTAX_MSG);
    return;
  }
  const out = await callGenerateSeoScript({ userId, topic: parsed.topic, keywords: parsed.keywords });
  if (!out.ok) {
    await sendMessage(
      chatId,
      out.code === 'BYOK_REQUIRED'
        ? SEO_SCRIPT_BYOK_MSG
        : `❌ SEO script thất bại (\`${out.code}\`): ${out.message}`,
    );
    return;
  }
  await sendMessage(chatId, formatSeoScriptSuccessMsg(out.result));
}

export async function handleSchedulePublish(chatId: string, rawArg: string): Promise<void> {
  const userId = await requirePairedUser(chatId);
  if (!userId) return;
  const { parsed, error } = parsePublishArg(rawArg);
  if (!parsed) {
    const errMsg = error?.startsWith('invalid_date:')
      ? `❌ ISO date không hợp lệ: \`${error.replace('invalid_date:', '')}\``
      : PUBLISH_SYNTAX_MSG;
    await sendMessage(chatId, errMsg);
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
  await sendMessage(chatId, formatPublishSuccessMsg(out.result));
}
