import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import { getUserCredential } from '@/tree/credentials/user-credentials-repo';
import type { SopStepDef, SopStepResult } from './types';

export async function executeStepTool(
  step: SopStepDef,
  inputJson: string,
  _priorResults: SopStepResult[],
  userId: string,
): Promise<Record<string, unknown>> {
  switch (step.tool) {
    case 'ai-script': {
      const openrouterKey = await getUserCredential(userId, 'openrouter');
      if (!openrouterKey) {
        return {
          script: '',
          word_count: 0,
          stub: true,
          error: 'OpenRouter API key not configured — add it in Settings > Integrations',
        };
      }

      const promptTemplate =
        (step.config?.prompt as string) ??
        `Generate a professional ${step.name_en} script for a social media video. Be concise and engaging.`;
      const argsJson = inputJson ? (JSON.parse(inputJson) as Record<string, string>) : {};
      const prompt = Object.entries(argsJson).reduce(
        (p, [k, v]) => p.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
        promptTemplate,
      );

      const content = await resilientChatCompletion(prompt, {
        openRouterKey: openrouterKey,
        model: 'openai/gpt-4o-mini',
      });

      const wordCount = content.split(/\s+/).filter(Boolean).length;

      return { script: content, word_count: wordCount, stub: false };
    }
    case 'ai-tts':
      return { audio_url: 'https://placeholder.example.com/audio.mp3', duration_sec: 0, stub: true };
    case 'ai-video':
      return { video_url: 'https://placeholder.example.com/video.mp4', duration_sec: 0, stub: true };
    case 'manual':
      return { status: 'awaiting_user', message: 'Manual step — operator action required' };
    case 'upload':
      return { upload_url: null, r2_key: null, stub: true };
    case 'analytics':
      return { metrics: {}, stub: true };
    default: {
      const exhaustiveCheck: never = step.tool;
      throw new Error(`[sopExecute] Unknown step tool: ${exhaustiveCheck}`);
    }
  }
}
