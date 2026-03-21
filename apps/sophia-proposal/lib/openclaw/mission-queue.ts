/**
 * MissionQueue — in-process concurrency limiter per org.
 *
 * Prevents a single org from flooding the PEV engine by capping concurrent
 * missions at ORG_CONCURRENCY (3). Uses a promise-chain per org so queued
 * missions execute FIFO without a separate message broker.
 */

import { createServerClient } from '@/lib/supabase/client';

const ORG_CONCURRENCY = 3;

// orgId → array of currently running promise slots
const orgSlots = new Map<string, Promise<void>[]>();

// missionId → queue position (1-based, 0 = running)
const positionMap = new Map<string, number>();

/**
 * Enqueue a mission for execution.
 * Resolves when the mission's turn arrives and it has been dequeued.
 * The caller is responsible for actually running the mission after this resolves.
 */
export async function enqueueMission(missionId: string): Promise<void> {
  const orgId = await getOrgIdForMission(missionId);
  if (!orgId) return;

  const slots = orgSlots.get(orgId) ?? [];
  orgSlots.set(orgId, slots);

  // Record position before appending (1-based; running slots are position 0)
  const position = Math.max(0, slots.length - ORG_CONCURRENCY + 1);
  positionMap.set(missionId, position);

  // Wait for a free slot: if we already have ORG_CONCURRENCY running,
  // wait for the oldest one to finish before adding ours.
  if (slots.length >= ORG_CONCURRENCY) {
    await slots[slots.length - ORG_CONCURRENCY];
  }

  // Create our slot promise and add it
  let resolve!: () => void;
  const slot = new Promise<void>((res) => { resolve = res; });
  slots.push(slot);
  positionMap.set(missionId, 0); // now running

  // Resolve immediately — the caller runs the mission, then we clean up
  resolve();

  // Prune completed slots to avoid unbounded growth
  const updated = (orgSlots.get(orgId) ?? []).filter(
    (s) => s !== slot
  );
  if (updated.length === 0) {
    orgSlots.delete(orgId);
  } else {
    orgSlots.set(orgId, updated);
  }

  positionMap.delete(missionId);
}

/**
 * Returns the 1-based queue position for a mission.
 * 0 = currently running, -1 = not in queue.
 */
export function getQueuePosition(missionId: string): number {
  return positionMap.get(missionId) ?? -1;
}

// --------------------------------------------------------------------------
// Private
// --------------------------------------------------------------------------

async function getOrgIdForMission(missionId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('missions')
    .select('org_id')
    .eq('id', missionId)
    .single();
  return data?.org_id ?? null;
}
