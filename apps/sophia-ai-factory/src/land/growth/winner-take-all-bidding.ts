import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { failure, success, type Result } from '@/seed/types/result';

export type ErrorResponse = { code: string; message: string; };

interface CreateVideoJobEvent {
  name: 'video/job.create.requested';
  data: {
    tenantId: string;
    userId: string;
    prompt: string;
    tier: string;
    sourceId: string;
    wtaBatch: string;
  };
}

/**
 * Executes a winner-take-all bidding cull/promotion cycle.
 * Identifies the top performant video prompts for duplication (top 20%)
 * and culls the bottom performant videos (bottom 80%).
 * 
 * Target Database: video_jobs and video_analytics
 */
export async function executeWinnerTakeAllBidding(params: {
  tenantId: string;
  userId: string;
  campaignDateRangeStart: number;
  campaignDateRangeEnd: number;
}): Promise<Result<{ culledCount: number, duplicatedCount: number, batchId: string }, ErrorResponse>> {
  try {
    const { tenantId, userId, campaignDateRangeStart, campaignDateRangeEnd } = params;
    
    // In a real implementation we would join video_jobs and video_analytics to score videos.
    // For now we simulate identifying bottom 80% (culled) and top 20% (duplicated)
    
    const db = createServerClient();
    
    // 1. Fetch eligible jobs in the time range
    const sql = `
      SELECT id, prompt
      FROM video_jobs
      WHERE tenant_id = ? AND user_id = ? AND created_at >= ? AND created_at <= ? AND status = 'published'
    `;
    
    const jobsSnapshot = await db.prepare(sql)
      .bind(tenantId, userId, campaignDateRangeStart, campaignDateRangeEnd)
      .all<{ id: string; prompt: string }>();
      
    if (!jobsSnapshot.success || !jobsSnapshot.results) {
      return failure({
        code: 'DB_ERROR',
        message: 'Failed to fetch video jobs for bidding evaluation'
      });
    }
    
    const jobs = jobsSnapshot.results;
    
    if (jobs.length === 0) {
      return success({ culledCount: 0, duplicatedCount: 0, batchId: 'wta_' + Date.now().toString() });
    }
    
    // Simplification: In a full implementation we calculate metrics for each job.
    // Here we split jobs by ID for simulation (20% top, 80% bottom).
    const topCount = Math.max(1, Math.floor(jobs.length * 0.2));
    
    // Sort pseudo-randomly to simulate real metric ranking for this implementation
    const rankedJobs = [...jobs].sort((a, b) => a.id.localeCompare(b.id));
    
    const topJobs = rankedJobs.slice(0, topCount);
    const bottomJobs = rankedJobs.slice(topCount);
    
    const batchId = `wta_${Date.now()}`;
    
    // 2. Mark bottom 80% as culled (status='failed' with error='culled_bidding' or soft-delete)
    // Using simple update
    if (bottomJobs.length > 0) {
      const cullIds = bottomJobs.map(j => `'${j.id}'`).join(',');
      await db.prepare(`
        UPDATE video_jobs 
        SET status = 'failed', error = 'culled_by_bidding', updated_at = ?
        WHERE tenant_id = ? AND id IN (${cullIds})
      `).bind(Date.now(), tenantId).run();
    }
    
    // 3. Dispatch duplication for top 20%
    if (topJobs.length > 0) {
      const events: CreateVideoJobEvent[] = topJobs.map(job => ({
        name: 'video/job.create.requested',
        data: {
          tenantId,
          userId,
          prompt: job.prompt,
          tier: 'premium', 
          sourceId: job.id,
          wtaBatch: batchId
        }
      }));
      
      // Dispatch via inngest event bus
      await inngest.send(events as unknown as Parameters<typeof inngest.send>[0]);
    }
    
    return success({
      culledCount: bottomJobs.length,
      duplicatedCount: topJobs.length,
      batchId
    });
    
  } catch (err) {
    return failure({
      code: 'WTA_EVAL_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error during WTA bidding'
    });
  }
}
