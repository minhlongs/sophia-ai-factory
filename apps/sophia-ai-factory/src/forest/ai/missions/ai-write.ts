/**
 * Handler: ai:write
 *
 * Generic SOP copywriter command. It supports the official no-code SOP playbooks
 * that use ai:write before video production, publishing, email, analytics, and
 * crisis steps.
 */

import { generateScript } from '@/seed/ai/script-generator';
import {
  ProviderInvalidKeyError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import { lookupUserApiKey } from '@/tree/byok/user-api-key-store';
import {
  missionFailure,
  type MissionContext,
  type MissionHandlerResult,
} from '@/forest/missions/types';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function slugTag(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join('');
}

function normalizePlatforms(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return ['tiktok', 'instagram', 'youtube', 'twitter'];
}

function makeCaption(topic: string, tone: string): string {
  const prefix = tone === 'professional'
    ? 'Practical insight:'
    : tone === 'inspiring'
      ? 'A better way starts here:'
      : 'Quick idea:';
  return `${prefix} ${topic}. Save this and share it with your team.`;
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { params, userId } = ctx;
  const task = asString(params.task, 'write');
  const topic = asString(params.topic, asString(params.original_caption, asString(params.subject, 'RaaS growth automation')));
  const tone = asString(params.tone, asString(params.brand_voice, 'professional'));
  const language = asString(params.language, 'en');
  const audience = asString(params.audience, 'RaaS operators and non-technical founders');

  if (task === 'video_script') {
    if (!userId || !userId.trim()) {
      return missionFailure('User ID is required for AI script generation', 'MISSING_USER');
    }

    const trustedOrgId = ctx.orgId?.trim();
    if (!trustedOrgId) {
      return missionFailure('Verified organization context is required for AI script generation', 'MISSING_ORG_CONTEXT');
    }

    const callerOrgId =
      typeof params.orgId === 'string' && params.orgId.trim()
        ? params.orgId.trim()
        : typeof params.org_id === 'string' && params.org_id.trim()
          ? params.org_id.trim()
          : null;
    if (callerOrgId && callerOrgId !== trustedOrgId) {
      return missionFailure('Organization context mismatch', 'UNAUTHORIZED_ORG');
    }

    let lookup;
    try {
      lookup = await lookupUserApiKey(userId, 'openrouter');
    } catch {
      return missionFailure('Customer OpenRouter credential could not be read', 'CREDENTIAL_READ_ERROR');
    }

    if (lookup.status === 'NOT_CONFIGURED' || (lookup.status === 'FOUND' && !lookup.key.trim())) {
      return missionFailure('Customer OpenRouter API key is required', 'MISSING_CREDENTIALS');
    }
    if (lookup.status !== 'FOUND') {
      return missionFailure('Customer OpenRouter credential could not be read', 'CREDENTIAL_READ_ERROR');
    }

    let scriptOutput;
    try {
      scriptOutput = await generateScript(
        {
          topic,
          audience,
          tier: 'BASIC',
          userId,
          orgId: trustedOrgId,
        },
        { funding: { fund: 'byok', apiKey: lookup.key.trim() } },
      );
    } catch (err) {
      if (err instanceof ProviderInvalidKeyError) {
        return missionFailure(err.message, 'PROVIDER_INVALID_KEY');
      }
      if (err instanceof ProviderQuotaExceededError) {
        return missionFailure(err.message, 'PROVIDER_QUOTA_EXCEEDED');
      }
      return missionFailure(
        err instanceof Error ? err.message : 'AI script generation failed',
        'GENERATION_FAILED',
      );
    }

    const script = scriptOutput.scenes.map((scene: { narration: string }) => scene.narration).join('\n\n');
    const caption = makeCaption(topic, tone);
    const hashtags = [
      `#${slugTag(topic) || 'raas'}`,
      '#aiVideo',
      '#automation',
    ];

    return {
      ok: true,
      data: {
        task,
        title: scriptOutput.title,
        script,
        videoScript: script,
        caption,
        hashtags,
        scenes: scriptOutput.scenes,
        durationSeconds: scriptOutput.total_duration,
        language,
      },
    };
  }

  if (task === 'adapt_captions') {
    const platforms = normalizePlatforms(params.platforms);
    const captions = Object.fromEntries(
      platforms.map((platform) => [
        platform,
        `${makeCaption(topic, tone)} ${platform === 'youtube' ? 'Full story in this short.' : ''}`.trim(),
      ]),
    );
    const hashtags = Object.fromEntries(
      platforms.map((platform) => [platform, [`#${platform}`, '#aiVideo', '#RaaS']]),
    );

    return {
      ok: true,
      data: {
        task,
        captions,
        hashtags,
        publishedPlatforms: [],
      },
    };
  }

  const content = makeCaption(topic, tone);
  return {
    ok: true,
    data: {
      task,
      content,
      text: content,
      summary: content,
      caption: content,
      hashtags: [`#${slugTag(topic) || 'raas'}`, '#automation'],
      language,
    },
  };
}
