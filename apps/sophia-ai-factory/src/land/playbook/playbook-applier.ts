/**
 * Playbook Applier — Phase 5c: Auto-Creative Playbook (COMPOUND stage)
 *
 * Maps a detected playbook rule onto the existing SOP install flow.
 * No new schema: `autoApply` and `source` are stored in the existing
 * `config_values` JSON column, so existing installs are untouched.
 *
 * Layer: land (business workflow — SOP install is a land concern).
 * Orchestration: called from forest cron + land API route; never imports forest.
 */

'use server';

import { createServerClient, type D1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { createInstallation } from '@/seed/sop/sop-repo-installations';
import { recordApply } from '@/land/playbook/rule-ops';
import type { PlaybookRule } from '@/seed/types/playbook-pattern';
import {
  buildPlaybookConfigValues,
  fetchInstallationPlaybookConfig,
  updateInstallationAutoApply,
  type PlaybookConfigValues,
} from './playbook-config-store';

export type { PlaybookConfigValues };

/**
 * Apply a playbook rule by installing the matching SOP template.
 * Returns the installation id on success, or a failure code otherwise.
 */
export async function applyPlaybook(
  rule: PlaybookRule,
  templateId: string,
  userId: string,
  scheduleCron?: string,
): Promise<{ success: true; installationId: string } | { success: false; code: string; message: string }> {
  let db: D1Client;
  try {
    db = createServerClient();
  } catch {
    return { success: false, code: 'DB_ERROR', message: 'Database not available' };
  }

  const configValues = buildPlaybookConfigValues(rule);

  try {
    const row = await createInstallation(db.unwrap(), {
      userId,
      templateId,
      scheduleCron,
      configValues,
    });

    try {
      await recordApply(rule.id);
    } catch (err) {
      logger.warn('[applyPlaybook] recordApply failed (non-fatal)', {
        ruleId: rule.id,
        error: String(err),
      });
    }

    logger.info('[applyPlaybook] Rule applied', {
      ruleId: rule.id,
      installationId: row.id,
      platform: rule.platform,
      goal: rule.goal,
    });

    return { success: true, installationId: row.id };
  } catch (err) {
    if ((err as unknown as { code?: string })?.code === 'PAYMENT_REQUIRED') {
      return {
        success: false,
        code: 'PAYMENT_REQUIRED',
        message: err instanceof Error ? err.message : 'Paid marketplace SOPs cannot be installed until checkout is enabled.',
      };
    }
    logger.error('[applyPlaybook] Install failed', err instanceof Error ? err : new Error(String(err)), {
      ruleId: rule.id,
      templateId,
    });
    return { success: false, code: 'DB_ERROR', message: 'Failed to install playbook' };
  }
}

/**
 * Toggle auto-apply on an existing playbook rule. Persists to the
 * config_values JSON of the backing installation — no schema change.
 */
export async function toggleAutoApply(
  installationId: string,
  enabled: boolean,
  userId: string,
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  return updateInstallationAutoApply(installationId, enabled, userId);
}

/** Read the PlaybookConfigValues for an installation (null if not playbook-sourced). */
export async function getPlaybookConfig(
  installationId: string,
  userId: string,
): Promise<PlaybookConfigValues | null> {
  return fetchInstallationPlaybookConfig(installationId, userId);
}
