/**
 * Playbook Config Store — D1 persistence helpers for Playbook Applier.
 *
 * Layer: land/playbook
 *
 * @module land/playbook/playbook-config-store
 */

import { createServerClient, type D1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
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

export function buildPlaybookConfigValues(rule: PlaybookRule): PlaybookConfigValues {
  return {
    source: 'playbook',
    ruleId: rule.id,
    platform: rule.platform,
    goal: rule.goal,
    autoApply: rule.autoApply,
    appliedAt: Math.floor(Date.now() / 1000),
  };
}

export async function updateInstallationAutoApply(
  installationId: string,
  enabled: boolean,
  userId: string,
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  let db: D1Client;
  try {
    db = createServerClient();
  } catch {
    return { success: false, code: 'DB_ERROR', message: 'Database not available' };
  }

  try {
    const row = await db
      .prepare(`SELECT config_values FROM user_sop_installations WHERE id = ?1 AND user_id = ?2`)
      .bind(installationId, userId)
      .first<{ config_values: string | null }>();

    if (!row) {
      return { success: false, code: 'NOT_FOUND', message: 'Installation not found' };
    }

    if (!row.config_values || (JSON.parse(row.config_values) as PlaybookConfigValues).source !== 'playbook') {
      return { success: false, code: 'NOT_FOUND', message: 'Playbook installation not found' };
    }

    const config: PlaybookConfigValues = row.config_values
      ? (JSON.parse(row.config_values) as PlaybookConfigValues)
      : { source: 'playbook', ruleId: '', platform: '', goal: '', autoApply: false, appliedAt: 0 };
    config.autoApply = enabled;

    await db
      .prepare(`UPDATE user_sop_installations SET config_values = ?1 WHERE id = ?2 AND user_id = ?3`)
      .bind(JSON.stringify(config), installationId, userId)
      .run();

    return { success: true };
  } catch (err) {
    logger.error('[toggleAutoApply] Failed', err instanceof Error ? err : new Error(String(err)), {
      installationId,
    });
    return { success: false, code: 'DB_ERROR', message: 'Failed to toggle auto-apply' };
  }
}

export async function fetchInstallationPlaybookConfig(
  installationId: string,
  userId: string,
): Promise<PlaybookConfigValues | null> {
  let db: D1Client;
  try {
    db = createServerClient();
  } catch {
    return null;
  }

  try {
    const row = await db
      .prepare(`SELECT config_values FROM user_sop_installations WHERE id = ?1 AND user_id = ?2`)
      .bind(installationId, userId)
      .first<{ config_values: string | null }>();

    if (!row?.config_values) return null;
    const config = JSON.parse(row.config_values) as PlaybookConfigValues;
    return config.source === 'playbook' ? config : null;
  } catch {
    return null;
  }
}
