/**
 * @file remix-db-insert.ts
 * @description Inserts a blueprint remix record into D1 with schema compatibility fallback.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { BlueprintRemixInput } from '@/seed/types/creator-marketplace';

export async function insertBlueprintRemixRow(
  db: D1Database,
  remixId: string,
  remix: BlueprintRemixInput,
  royaltyCents: number,
  nowMs: number,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO blueprint_remixes (
          id, blueprint_id, creator_id, remixer_id, remixer_user_id, mission_id, royalty_cents, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        remixId,
        remix.blueprintId,
        remix.parentCreatorId,
        remix.remixerUserId,
        remix.remixerUserId,
        remix.missionId,
        royaltyCents,
        nowMs,
      )
      .run();
  } catch (remixErr: unknown) {
    const errStr = String(remixErr);
    if (errStr.includes('no column named') || errStr.includes('has no column named')) {
      await db
        .prepare(
          `INSERT INTO blueprint_remixes (
            id, blueprint_id, creator_id, remixer_id, mission_id, royalty_cents, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          remixId,
          remix.blueprintId,
          remix.parentCreatorId,
          remix.remixerUserId,
          remix.missionId,
          royaltyCents,
          nowMs,
        )
        .run();
    } else {
      throw remixErr;
    }
  }
}
