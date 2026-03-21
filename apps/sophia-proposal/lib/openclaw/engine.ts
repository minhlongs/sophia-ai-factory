/**
 * OpenClawEngine — PEV orchestrator with retry, sub-mission chaining, and webhooks.
 *
 * Lifecycle per mission:
 *   Plan → Execute (step-by-step tracking) → Verify → Complete | Retry | Fail
 *
 * Sub-missions (e.g. gtm:campaign) are spawned as child missions and run
 * in parallel or sequential order based on their dependency_type.
 */

import { createServerClient } from '@/lib/supabase/client';
import { executeCommand } from '@/lib/raas/command-router';
import { StepTracker } from './step-tracker';
import type { Mission, MissionCommand, PEVPlan, PEVStep, SubMissionDef } from '@/types/raas';

// ── Plan builder ─────────────────────────────────────────────────────────────

const STEP_NAMES: Record<string, string[]> = {
  'proposal:create':    ['Parse params', 'Generate proposal content', 'Save to database'],
  'video:create':       ['Generate script', 'Submit to HeyGen', 'Poll for completion'],
  'affiliate:generate': ['Fetch program data', 'Generate blog post', 'Generate social bundle'],
  'affiliate:scrape':   ['Connect to PartnerStack', 'Normalize programs', 'Upsert to database'],
  'content:blog':       ['Research topic', 'Generate SEO post', 'Save content'],
  'content:social':     ['Fetch context', 'Generate LinkedIn/Twitter/TikTok', 'Save bundle'],
  'crm:sync':           ['Connect to HubSpot', 'Sync contacts', 'Sync deals'],
  'analytics:export':   ['Query usage data', 'Format output', 'Return export'],
  'gtm:campaign':       ['Create proposal', 'Queue video', 'Generate blog', 'Generate social'],
  'sales:battlecard':   ['Research competitor', 'Generate battlecard', 'Save to database'],
};

function buildPlan(command: MissionCommand): PEVPlan {
  const steps: PEVStep[] = (STEP_NAMES[command] ?? ['Execute command']).map((s) => ({
    step: s,
    status: 'pending',
  }));
  return { command, steps, estimated_duration_ms: steps.length * 3000 };
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class OpenClawEngine {
  /**
   * Run a mission through the full PEV cycle with retry support.
   * Never throws — all failures are persisted to the DB.
   */
  async execute(missionId: string): Promise<void> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('id', missionId)
      .single();

    if (error || !data) {
      console.error(`[OpenClaw] Mission ${missionId} not found:`, error?.message);
      return;
    }

    const mission = data as Mission;

    // ── PLAN ─────────────────────────────────────────────────────────────────
    const plan = buildPlan(mission.command);
    const tracker = new StepTracker(missionId, plan.steps);

    await supabase.from('missions').update({
      status: 'planning',
      plan,
      execution_log: tracker.getSteps(),
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', missionId);

    // ── EXECUTE ───────────────────────────────────────────────────────────────
    await supabase.from('missions').update({
      status: 'executing',
      updated_at: new Date().toISOString(),
    }).eq('id', missionId);

    // Mark each step running individually for real-time progress
    for (let i = 0; i < plan.steps.length; i++) {
      await tracker.markStep(i, 'running');
    }

    const result = await executeCommand(mission);

    // ── VERIFY ────────────────────────────────────────────────────────────────
    await supabase.from('missions').update({
      status: 'verifying',
      updated_at: new Date().toISOString(),
    }).eq('id', missionId);

    const verified = result.success && result.data !== undefined;

    if (!result.success || !verified) {
      await tracker.markAllFailed(result.error ?? 'Execution failed');

      // Retry if attempts remain
      const retried = await this.retryWithBackoff(missionId, (mission.retry_count ?? 0) + 1);
      if (retried) return; // retry loop took over

      // Refund MCU on permanent failure
      await supabase.rpc('credit_mcu_balance', {
        p_org_id: mission.org_id,
        p_amount: mission.mcu_reserved,
        p_subscription_id: `mission:refund:${missionId}`,
      });

      await supabase.from('missions').update({
        status: 'failed',
        result: result as unknown as object,
        error_message: result.error ?? 'Execution failed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', missionId);

      return;
    }

    // ── COMPLETE ──────────────────────────────────────────────────────────────
    await tracker.markAllDone();

    const completedAt = new Date().toISOString();
    await supabase.from('missions').update({
      status: 'completed',
      result: result as unknown as object,
      completed_at: completedAt,
      updated_at: completedAt,
    }).eq('id', missionId);

    // Propagate completion to parent if this is a sub-mission
    if (mission.parent_mission_id) {
      await this.checkParentCompletion(mission.parent_mission_id);
    }

    // Fire webhook if configured
    if (mission.webhook_url) {
      await this.notifyWebhook({ ...mission, status: 'completed', completed_at: completedAt });
    }
  }

  /**
   * Create child missions from SubMissionDef list and run them.
   * Sequential deps run one-after-one; parallel deps are launched concurrently.
   */
  async orchestrateSubMissions(
    parentId: string,
    commands: SubMissionDef[]
  ): Promise<void> {
    const supabase = createServerClient();

    // Fetch parent to inherit org_id
    const { data: parent } = await supabase
      .from('missions')
      .select('org_id')
      .eq('id', parentId)
      .single();

    if (!parent) return;

    const sequential = commands.filter((c) => c.dependency_type === 'sequential');
    const parallel   = commands.filter((c) => c.dependency_type === 'parallel');

    // Run sequential sub-missions in order
    for (const def of sequential) {
      const childId = await this.createSubMission(parentId, parent.org_id, def);
      if (childId) await this.execute(childId);
    }

    // Run parallel sub-missions concurrently
    if (parallel.length > 0) {
      const childIds = await Promise.all(
        parallel.map((def) => this.createSubMission(parentId, parent.org_id, def))
      );
      await Promise.all(
        childIds.filter(Boolean).map((id) => this.execute(id!))
      );
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /** Exponential backoff retry: delays 1s, 2s, 4s … up to max_retries. */
  private async retryWithBackoff(missionId: string, attempt: number): Promise<boolean> {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('missions')
      .select('max_retries, retry_count, error_message')
      .eq('id', missionId)
      .single();

    if (!data || attempt > (data.max_retries ?? 3)) return false;

    // Log the retry attempt
    await supabase.from('mission_retries').insert({
      mission_id: missionId,
      attempt_number: attempt,
      error_message: data.error_message,
    });

    // Exponential backoff: 1s × 2^(attempt-1)
    const delayMs = 1000 * Math.pow(2, attempt - 1);
    await new Promise((res) => setTimeout(res, delayMs));

    await supabase.from('missions').update({
      status: 'queued',
      retry_count: attempt,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq('id', missionId);

    // Re-run from the top
    await this.execute(missionId);
    return true;
  }

  /** Check if all sibling sub-missions are done → complete the parent. */
  private async checkParentCompletion(parentMissionId: string): Promise<void> {
    const supabase = createServerClient();
    const { data: siblings } = await supabase
      .from('missions')
      .select('status')
      .eq('parent_mission_id', parentMissionId);

    if (!siblings || siblings.length === 0) return;

    const allDone = siblings.every((s) => s.status === 'completed');
    const anyFailed = siblings.some((s) => s.status === 'failed');

    if (allDone) {
      await supabase.from('missions').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', parentMissionId);
    } else if (anyFailed) {
      await supabase.from('missions').update({
        status: 'failed',
        error_message: 'One or more sub-missions failed',
        updated_at: new Date().toISOString(),
      }).eq('id', parentMissionId);
    }
  }

  /** Check if hostname is in 172.16.0.0/12 private range. */
  private isPrivate172(h: string): boolean {
    if (!h.startsWith('172.')) return false;
    const second = parseInt(h.split('.')[1], 10);
    return second >= 16 && second <= 31;
  }

  /** Validate webhook URL to prevent SSRF (block internal/cloud metadata IPs). */
  private isWebhookUrlSafe(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      const host = parsed.hostname;
      // Block internal ranges, cloud metadata, localhost
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
      if (host.startsWith('10.') || host.startsWith('192.168.') || this.isPrivate172(host)) return false;
      if (host === '169.254.169.254' || host.endsWith('.internal')) return false;
      return true;
    } catch {
      return false;
    }
  }

  /** Fire-and-forget POST to webhook_url with SSRF protection. */
  private async notifyWebhook(mission: Mission): Promise<void> {
    if (!mission.webhook_url || !this.isWebhookUrlSafe(mission.webhook_url)) return;
    try {
      await fetch(mission.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mission_id: mission.id,
          status: mission.status,
          command: mission.command,
          result: mission.result,
          completed_at: mission.completed_at,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      console.error(`[OpenClaw] Webhook failed for mission ${mission.id}:`, err);
    }
  }

  /** Insert a child mission record and register the dependency link. */
  private async createSubMission(
    parentId: string,
    orgId: string,
    def: SubMissionDef
  ): Promise<string | null> {
    const supabase = createServerClient();

    const { data: child, error } = await supabase
      .from('missions')
      .insert({
        org_id: orgId,
        title: def.title,
        command: def.command,
        params: def.params,
        parent_mission_id: parentId,
        is_sub_mission: true,
        status: 'queued',
      })
      .select('id')
      .single();

    if (error || !child) {
      console.error(`[OpenClaw] Failed to create sub-mission "${def.title}":`, error?.message);
      return null;
    }

    await supabase.from('mission_dependencies').insert({
      parent_mission_id: parentId,
      child_mission_id: child.id,
      dependency_type: def.dependency_type,
    });

    return child.id;
  }
}
