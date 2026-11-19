'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { ServiceFactory } from '@/land/services/factory';
import {
  MissingCredentialsError,
  ProviderInvalidKeyError,
  ProviderNetworkError,
  ProviderQuotaExceededError,
} from '@/seed/services/errors';
import {
  insertCampaignRecord,
  sendCampaignCreatedEvent,
} from '@/land/campaigns';

export async function generateVideoScriptAction(promptTopic: string): Promise<{
  success: boolean;
  scriptText?: string;
  error?: string;
  code?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      };
    }

    const tier = await resolveUserTier(user.id);
    const orgId = await resolveOrgId(user.id);
    const topic = promptTopic.trim() || 'High-converting AI SaaS automation workflow';

    const scriptService = await ServiceFactory.getScriptService(user.id);
    const generated = await scriptService.generateScript({
      topic,
      audience: 'Entrepreneurs & Creators',
      tier,
      userId: user.id,
      orgId: orgId ?? user.id,
    });

    const scriptLines = [
      generated.title,
      ...(generated.scenes?.map((s) => s.narration) ?? []),
    ].filter(Boolean);

    return {
      success: true,
      scriptText: scriptLines.join('\n\n'),
    };
  } catch (err) {
    if (err instanceof MissingCredentialsError) {
      return {
        success: false,
        error: 'Connect your OpenRouter key in Settings before generating a script.',
        code: 'BYOK_KEY_REQUIRED',
      };
    }
    if (err instanceof ProviderInvalidKeyError) {
      return {
        success: false,
        error: 'Your OpenRouter API key was rejected. Please update it in Settings.',
        code: 'BYOK_KEY_INVALID',
      };
    }
    if (err instanceof ProviderQuotaExceededError) {
      return {
        success: false,
        error: 'Your OpenRouter account has insufficient credits or hit a rate limit.',
        code: 'BYOK_QUOTA_EXCEEDED',
      };
    }
    if (err instanceof ProviderNetworkError) {
      return {
        success: false,
        error: 'Your OpenRouter key is unavailable. Reconnect it in Settings or retry later.',
        code: 'BYOK_KEY_UNAVAILABLE',
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate AI script',
    };
  }
}

export async function dispatchVideoCreationJobAction(input: {
  script: string;
  voice: string;
  style: string;
}): Promise<{
  success: boolean;
  campaignId?: string;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const tier = await resolveUserTier(user.id);
    const orgId = await resolveOrgId(user.id);
    const campaignId = crypto.randomUUID();
    const title = input.script.trim().slice(0, 60) || 'AI Studio Video';

    const insertRes = await insertCampaignRecord({
      campaignId,
      userId: user.id,
      orgId: orgId ?? user.id,
      title,
      topic: input.script.trim() || title,
      audience: `${input.voice}:${input.style}`,
    });

    if (!insertRes.success) {
      return { success: false, error: insertRes.error || 'Failed to create campaign' };
    }

    try {
      await sendCampaignCreatedEvent({
        campaignId,
        userId: user.id,
        topic: input.script.trim() || title,
        audience: 'General',
        tier,
      });
    } catch {
      // Non-blocking if Inngest dev server is offline
    }

    return { success: true, campaignId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to dispatch video creation job',
    };
  }
}
