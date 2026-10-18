/**
 * Internal helpers for automation server actions.
 *
 * @module app/actions/automation-helpers
 */

import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { Tier } from "@/seed/types";
import { logger } from "@/seed/utils/logger-utility";

export async function getAuthenticatedUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export async function triggerGenerateScriptWebhook(params: {
  scriptId: string;
  topic: string;
  audience: string;
  userId: string;
  tier: Tier;
}): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_GENERATE_SCRIPT;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function triggerRenderVideoWebhook(params: {
  scriptId: string;
  userId: string;
}): void {
  const webhookUrl = process.env.N8N_WEBHOOK_RENDER_VIDEO;
  if (!webhookUrl) return;

  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch((err) => {
    logger.error(
      "Video render webhook failed",
      err instanceof Error ? err : undefined,
      { scriptId: params.scriptId, webhookUrl },
    );
  });
}
