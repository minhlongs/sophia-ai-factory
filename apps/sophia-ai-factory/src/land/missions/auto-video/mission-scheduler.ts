/**
 * Auto Video Mission Scheduler & Video Render Handler
 *
 * Layer: land
 *
 * @module land/missions/auto-video/mission-scheduler
 */

import { schedulePublish, PublishConfigurationError } from '@/land/publish/schedule-video-publish';
import { submitByokVideo, RenderByokVideoError } from '@/land/video/generation/render-byok-video';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { isAffiliateKillSwitchActive } from '@/tree/affiliate/kill-switch/kill-switch-store';
import { verifyAndEnforceCampaignApprovalD1 } from '@/tree/affiliate/approval/campaign-approval-guard';
import { AutoVideoMissionError, type AutoVideoMissionInput, type AutoVideoMissionResult } from './types';

async function enforcePreSideEffectGuards(
  input: AutoVideoMissionInput,
  scriptText: string,
  missionId: string,
): Promise<void> {
  const tenantId = input.tenantId ?? input.userId;
  const killSwitchActive = await isAffiliateKillSwitchActive(tenantId);

  if (input.requireCeoApproval || input.campaignId || input.approvalPayload) {
    const db = await getD1();
    if (!db) {
      throw new AutoVideoMissionError('PERSIST_FAILED', 'D1 database binding not available for approval check', missionId);
    }
    const campaignId = input.campaignId ?? missionId;
    const payload = input.approvalPayload ?? {
      scriptBody: scriptText,
      affiliateTargetUrl: '',
      jurisdiction: input.jurisdiction ?? 'US',
      disclosureText: '#ad',
      maxRenderCostCents: Math.round((input.estimatedCostUsd ?? 0.02) * 100),
      targetAccount: input.channelId,
    };
    const verification = await verifyAndEnforceCampaignApprovalD1(
      db,
      tenantId,
      campaignId,
      payload,
      killSwitchActive,
    );
    if (!verification.ok) {
      throw new AutoVideoMissionError(
        verification.error.code,
        verification.error.message,
        missionId,
      );
    }
  } else if (killSwitchActive) {
    throw new AutoVideoMissionError(
      'KILL_SWITCH_ACTIVE',
      'Affiliate emergency kill switch is active for this workspace',
      missionId,
    );
  }
}

/**
 * Step 4: Optional HeyGen video render submit.
 */
export async function submitMissionVideo(
  input: AutoVideoMissionInput,
  scriptText: string,
  title: string,
  missionId: string,
): Promise<AutoVideoMissionResult['video']> {
  await enforcePreSideEffectGuards(input, scriptText, missionId);

  try {
    const submit = await submitByokVideo({
      userId: input.userId,
      script: scriptText,
      title,
    });
    return {
      videoId: submit.videoId,
      heygenJobId: submit.heygenJobId,
      status: submit.status,
      ...(submit.videoUrl ? { videoUrl: submit.videoUrl } : {}),
    };
  } catch (err) {
    if (err instanceof RenderByokVideoError && err.code === 'BYOK_REQUIRED') {
      logger.info('[auto-video-mission] HeyGen render skipped (no BYOK key)', { missionId });
      return undefined;
    }
    const msg = err instanceof Error ? err.message : 'video submit failed';
    throw new AutoVideoMissionError('VIDEO_RENDER_FAILED', msg, missionId);
  }
}

/**
 * Step 5: Optional publish schedule.
 */
export async function scheduleMissionPublish(
  input: AutoVideoMissionInput,
  videoResult: AutoVideoMissionResult['video'],
  caption: string,
  missionId: string,
): Promise<AutoVideoMissionResult['publish']> {
  if (!input.channelId) {
    return undefined;
  }

  const tenantId = input.tenantId ?? input.userId;
  if (await isAffiliateKillSwitchActive(tenantId)) {
    return { skipped: true, reason: 'kill_switch_active' };
  }

  const realVideoId = videoResult?.videoId;
  if (!realVideoId) {
    // Soft-skip: no video row yet because HeyGen BYOK was not configured.
    logger.info('[auto-video-mission] publish skipped — no video row (no BYOK key)', { missionId });
    return { skipped: true, reason: 'no_byok' };
  }

  const scheduledAt = input.scheduledAt ?? Math.floor(Date.now() / 1000) + 3600;
  try {
    const sch = await schedulePublish({
      userId: input.userId,
      tenantId,
      videoId: realVideoId,
      channelId: input.channelId,
      scheduledAt,
      caption,
    });
    return { jobId: sch.jobId, scheduledAt: sch.scheduledAt };
  } catch (err) {
    const isMissingVideo = err instanceof PublishConfigurationError && err.code === 'VIDEO_NOT_FOUND';
    logger.warn('[auto-video-mission] schedule step failed', {
      missionId,
      reason: isMissingVideo ? 'video_row_not_created_yet' : 'unknown',
    });
    return undefined;
  }
}
