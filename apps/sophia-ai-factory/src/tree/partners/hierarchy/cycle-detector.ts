/**
 * Anti-Circularity & Cycle Detection Engine
 *
 * Layer: tree (domain business logic & graph traversal)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/hierarchy/cycle-detector
 */

import type { D1Database } from '@cloudflare/workers-types';

const MAX_HIERARCHY_DEPTH = 50;
const MAX_DESCENDANT_ITERATIONS = 500;

/**
 * Checks for circular references between a proposed Master and Sub agency relationship.
 * Walks both up ancestors of Master and down descendants of Sub.
 */
export async function detectHierarchyCycle(
  db: D1Database,
  masterPartnerId: string,
  subPartnerId: string,
): Promise<boolean> {
  // Direct cycle check
  if (masterPartnerId === subPartnerId) {
    return true;
  }

  // 1. Walk up ancestor hierarchy from masterPartnerId
  let currentAncestorId: string | null = masterPartnerId;
  const visitedAncestors = new Set<string>();
  let depth = 0;

  while (currentAncestorId && depth < MAX_HIERARCHY_DEPTH) {
    if (currentAncestorId === subPartnerId) {
      return true;
    }
    if (visitedAncestors.has(currentAncestorId)) {
      break;
    }
    visitedAncestors.add(currentAncestorId);

    const parentRow: { master_partner_id: string } | null = await db
      .prepare('SELECT master_partner_id FROM partner_sub_resellers WHERE sub_partner_id = ? AND status != ?')
      .bind(currentAncestorId, 'terminated')
      .first<{ master_partner_id: string }>();

    if (!parentRow) {
      break;
    }

    if (parentRow.master_partner_id === subPartnerId) {
      return true;
    }

    currentAncestorId = parentRow.master_partner_id;
    depth++;
  }

  // 2. Walk down descendant hierarchy from subPartnerId
  const queue: string[] = [subPartnerId];
  const seenDescendants = new Set<string>([subPartnerId]);
  let descIterations = 0;

  while (queue.length > 0 && descIterations < MAX_DESCENDANT_ITERATIONS) {
    const current = queue.shift()!;
    descIterations++;

    const children = await db
      .prepare('SELECT sub_partner_id FROM partner_sub_resellers WHERE master_partner_id = ? AND status != ?')
      .bind(current, 'terminated')
      .all<{ sub_partner_id: string }>();

    for (const child of children.results ?? []) {
      if (child.sub_partner_id === masterPartnerId) {
        return true;
      }
      if (!seenDescendants.has(child.sub_partner_id)) {
        seenDescendants.add(child.sub_partner_id);
        queue.push(child.sub_partner_id);
      }
    }
  }

  return false;
}
