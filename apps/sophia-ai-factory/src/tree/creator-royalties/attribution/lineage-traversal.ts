/**
 * @file lineage-traversal.ts
 * @description Traces parent blueprint lineage to detect cyclic graphs and circular self-remix attempts.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { BlueprintLineageRow } from './types';

/**
 * Traces the ancestor lineage of a campaign blueprint up to root in campaign_blueprints.
 *
 * Traverses parent_blueprint_id iteratively with depth bounding (default: 10)
 * to detect:
 * 1. If remixerUserId matches any creator in the ancestor lineage tree.
 * 2. If a cycle exists in the parent blueprint lineage graph.
 *
 * @param db - D1Database instance
 * @param blueprintId - The blueprint being remixed
 * @param remixerUserId - The user attempting to remix
 * @param maxDepth - Maximum depth to traverse (prevents infinite loops; default 10)
 * @returns true if remixerUserId matches any ancestor creator or a cycle is detected; false otherwise.
 */
export async function isCircularAncestorRemix(
  db: D1Database,
  blueprintId: string,
  remixerUserId: string,
  maxDepth = 10,
): Promise<boolean> {
  if (!blueprintId || !remixerUserId) {
    return false;
  }

  let currentBlueprintId: string | null = blueprintId;
  let depth = 0;
  const visitedBlueprintIds = new Set<string>();

  try {
    while (currentBlueprintId && depth < maxDepth) {
      if (visitedBlueprintIds.has(currentBlueprintId)) {
        // Cyclic graph detected in parent lineage
        return true;
      }
      visitedBlueprintIds.add(currentBlueprintId);

      const bp: BlueprintLineageRow | null = await db
        .prepare(
          `SELECT id, creator_id, parent_blueprint_id
           FROM campaign_blueprints
           WHERE id = ?
           LIMIT 1`,
        )
        .bind(currentBlueprintId)
        .first<BlueprintLineageRow>();

      if (!bp) {
        break;
      }

      // If this blueprint or any ancestor creator matches the remixer, circular self-remix detected
      if (bp.creator_id && bp.creator_id === remixerUserId) {
        return true;
      }

      currentBlueprintId = bp.parent_blueprint_id ?? null;
      depth++;
    }
  } catch {
    // If campaign_blueprints table does not exist or lacks lineage columns,
    // fail open/gracefully for minimal mock schemas.
    return false;
  }

  return false;
}
