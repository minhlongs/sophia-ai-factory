/**
 * Handler: thumbnail:generate
 *
 * Generates an AI thumbnail image via OpenAI gpt-image-1 using the user's own API key.
 * Resolves key via BYOK: openai credential first, then openrouter fallback.
 *
 * LIVE — requires OpenAI (or OpenRouter) API key in user_provider_credentials.
 */

import { getThumbnailKey } from '@/tree/credentials/get-provider-key';
import { ThumbnailClient } from '@/lib/video/thumbnail-client';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from './types';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const prompt = (params?.prompt as string) ?? '';
  const title = (params?.title as string) ?? '';
  const style = (params?.style as 'vivid' | 'natural') ?? 'vivid';

  if (!prompt) {
    return { ok: false, error: 'prompt is required for thumbnail generation.' };
  }

  const keyResult = await getThumbnailKey({ userId, fallbackToPlatform: false });
  if (!keyResult) {
    return {
      ok: false,
      error: 'OpenAI API key not configured. Add it in Settings > Integrations.',
    };
  }

  // Build a richer prompt when a title is provided
  const fullPrompt = title
    ? `YouTube thumbnail for "${title}". ${prompt}`
    : prompt;

  logger.info('[thumbnail:generate] Generating thumbnail', {
    userId,
    keySource: keyResult.source,
    style,
  });

  try {
    const client = new ThumbnailClient({ apiKey: keyResult.key });
    const result = await client.generateThumbnail({
      prompt: fullPrompt,
      size: '1792x1024',
      quality: 'hd',
      style,
    });

    return {
      ok: true,
      data: {
        imageUrl: result.imageUrl,
        revisedPrompt: result.revisedPrompt ?? null,
      },
    };
  } catch (err) {
    logger.error(
      '[thumbnail:generate] OpenAI error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Thumbnail generation failed',
    };
  }
}
