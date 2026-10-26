'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { generateScript } from '@/seed/ai/script-generator';
import { resolveUserApiKey, type ByokProvider } from '@/tree/byok/resolve-user-api-key';
import {
  insertCampaignRecord,
  sendCampaignCreatedEvent,
} from '@/land/campaigns';

export async function generateVideoScriptAction(promptTopic: string): Promise<{
  success: boolean;
  scriptText?: string;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const tier = user ? await resolveUserTier(user.id) : 'BASIC';
    const topic = promptTopic.trim() || 'High-converting AI SaaS automation workflow';

    const generated = await generateScript(
      {
        topic,
        audience: 'Entrepreneurs & Creators',
        tier,
        userId: user?.id,
      },
      {
        resolveUserApiKey: (uid, prov, fb) =>
          resolveUserApiKey(uid, prov as ByokProvider, fb),
      },
    );

    const scriptLines = [
      generated.title,
      ...(generated.scenes?.map((s) => s.narration) ?? []),
    ].filter(Boolean);

    return {
      success: true,
      scriptText: scriptLines.join('\n\n'),
    };
  } catch (err) {
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
