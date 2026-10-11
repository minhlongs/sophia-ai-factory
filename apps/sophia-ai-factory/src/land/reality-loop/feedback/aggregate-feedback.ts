import { getD1 } from '@/seed/db/client';
import type { D1Result } from '@cloudflare/workers-types';
import type {
  FeedbackAggregate,
  FeedbackCheckpoint,
  FeedbackReason,
} from './types';

/** Aggregate feedback counts per workspace — powers the dashboard. */
export async function aggregateFeedbackByWorkspace(
  workspaceId: string,
): Promise<FeedbackAggregate> {
  const db = await getD1();
  if (!db) {
    return {
      total: 0,
      usefulYes: 0,
      usefulNo: 0,
      byCheckpoint: {
        mission_complete: { yes: 0, no: 0 },
        creative_rejected: { yes: 0, no: 0 },
        human_correction: { yes: 0, no: 0 },
        mission_abandoned: { yes: 0, no: 0 },
      },
      topReasons: [],
    };
  }

  const queryResult = (await db
    .prepare(
      `SELECT checkpoint, useful, reason, COUNT(*) AS cnt
       FROM reality_feedback
       WHERE workspace_id = ?1
       GROUP BY checkpoint, useful, reason`,
    )
    .bind(workspaceId)
    .all<{ checkpoint: string; useful: string; reason: string | null; cnt: number }>()) as D1Result<{
    checkpoint: string;
    useful: string;
    reason: string | null;
    cnt: number;
  }>;

  const rows = queryResult.results ?? [];

  const emptyCheckpoint = (): { yes: number; no: number } => ({ yes: 0, no: 0 });
  const byCheckpoint: Record<FeedbackCheckpoint, { yes: number; no: number }> = {
    mission_complete: emptyCheckpoint(),
    creative_rejected: emptyCheckpoint(),
    human_correction: emptyCheckpoint(),
    mission_abandoned: emptyCheckpoint(),
  };
  const reasonCounts = new Map<FeedbackReason, number>();
  let total = 0;
  let usefulYes = 0;
  let usefulNo = 0;

  for (const r of rows) {
    total += r.cnt;
    const cp = r.checkpoint as FeedbackCheckpoint;
    if (r.useful === 'YES') {
      usefulYes += r.cnt;
      byCheckpoint[cp].yes += r.cnt;
    } else {
      usefulNo += r.cnt;
      byCheckpoint[cp].no += r.cnt;
    }
    if (r.reason) {
      reasonCounts.set(r.reason as FeedbackReason, (reasonCounts.get(r.reason as FeedbackReason) ?? 0) + r.cnt);
    }
  }

  const topReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { total, usefulYes, usefulNo, byCheckpoint, topReasons };
}
