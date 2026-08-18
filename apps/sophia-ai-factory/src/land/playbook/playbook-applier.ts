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

/** Shape of the config_values blob we stamp onto an install. */
export interface PlaybookConfigValues {
  source: 'playbook';
  ruleId: string;
  platform: string;
  goal: string;
  autoApply: boolean;
  appliedAt: number;
  [key: string]: unknown;
}

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

  const configValues: PlaybookConfigValues = {
    source: 'playbook',
    ruleId: rule.id,
    platform: rule.platform,
    goal: rule.goal,
    autoApply: rule.autoApply,
    appliedAt: Math.floor(Date.now() / 1000),
  };

  try {
    const row = await createInstallation(db.unwrap(), {
      userId,
      templateId,
      scheduleCron,
      configValues,
    });

    // Track apply count on the rule itself (idempotent).
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
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  let db: D1Client;
  try {
    db = createServerClient();
  } catch {
    return { success: false, code: 'DB_ERROR', message: 'Database not available' };
  }

  try {
    const row = await db
      .prepare(`SELECT config_values FROM user_sop_installations WHERE id = ?1`)
      .bind(installationId)
      .first<{ config_values: string | null }>();

    if (!row) {
      return { success: false, code: 'NOT_FOUND', message: 'Installation not found' };
    }

    const config: PlaybookConfigValues = row.config_values
      ? (JSON.parse(row.config_values) as PlaybookConfigValues)
      : { source: 'playbook', ruleId: '', platform: '', goal: '', autoApply: false, appliedAt: 0 };
    config.autoApply = enabled;

    await db
      .prepare(`UPDATE user_sop_installations SET config_values = ?1 WHERE id = ?2`)
      .bind(JSON.stringify(config), installationId)
      .run();

    return { success: true };
  } catch (err) {
    logger.error('[toggleAutoApply] Failed', err instanceof Error ? err : new Error(String(err)), {
      installationId,
    });
    return { success: false, code: 'DB_ERROR', message: 'Failed to toggle auto-apply' };
  }
}

/** Read the PlaybookConfigValues for an installation (null if not playbook-sourced). */
export async function getPlaybookConfig(
  installationId: string,
): Promise<PlaybookConfigValues | null> {
  let db: D1Client;
  try {
    db = createServerClient();
  } catch {
    return null;
  }

  try {
    const row = await db
      .prepare(`SELECT config_values FROM user_sop_installations WHERE id = ?1`)
      .bind(installationId)
      .first<{ config_values: string | null }>();

    if (!row?.config_values) return null;
    const config = JSON.parse(row.config_values) as PlaybookConfigValues;
    return config.source === 'playbook' ? config : null;
  } catch {
    return null;
  }
}