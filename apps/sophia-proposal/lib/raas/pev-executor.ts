/**
 * PEV Executor — thin wrapper around OpenClawEngine for backward compatibility.
 *
 * All PEV logic (Plan → Execute → Verify, retry, sub-missions, webhooks)
 * lives in lib/openclaw/engine.ts. This file re-exports runMission so
 * existing callers require no changes.
 */

import { OpenClawEngine } from '@/lib/openclaw/engine';

const engine = new OpenClawEngine();

/**
 * Run the full Plan → Execute → Verify cycle for a mission.
 * Delegates entirely to OpenClawEngine. Never throws.
 */
export async function runMission(missionId: string): Promise<void> {
  return engine.execute(missionId);
}
