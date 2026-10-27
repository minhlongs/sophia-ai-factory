/**
 * Auto Video Mission Execution Service
 *
 * Layer: land
 *
 * @module land/missions/auto-video/auto-video-service
 */

import { isAffiliateKillSwitchActive } from '@/tree/affiliate/kill-switch/kill-switch-store';
import {
  AutoVideoMissionError,
  type AutoVideoMissionInput,
  type AutoVideoMissionResult,
} from './types';
import { buildMissionScript, buildMissionDescription } from './prompt-builder';
import { submitMissionVideo, scheduleMissionPublish } from './mission-scheduler';
import {
  insertMissionRow,
  markMissionBlocked,
  markMissionFailed,
  markMissionInProgress,
  markMissionSucceeded,
} from './auto-video-persistence';

/** End-to-end autonomous mission. Persists progress; throws AutoVideoMissionError on any failure. */
export async function runAutoVideoMission(
  input: AutoVideoMissionInput,
): Promise<AutoVideoMissionResult> {
  if (!input.topic?.trim()) {
    throw new AutoVideoMissionError('EMPTY_TOPIC', 'topic is required');
  }

  const tenantId = input.tenantId ?? input.userId;

  if (await isAffiliateKillSwitchActive(tenantId)) {
    throw new AutoVideoMissionError(
      'KILL_SWITCH_ACTIVE',
      'Affiliate emergency kill switch is active for this workspace',
    );
  }

  const missionId = await insertMissionRow(input.userId, input);
  const primaryLanguage = input.primaryLanguage ?? 'en';

  try {
    // Step 1 & 2: SEO script generation and optional translation
    const script = await buildMissionScript(input, missionId, primaryLanguage);

    // Step 3: Affiliate-enriched description
    const description = await buildMissionDescription(input, script.primary.body, missionId);

    // Step 4: Optional HeyGen video render submit
    const video = await submitMissionVideo(
      input,
      script.primary.body,
      script.primary.suggestedTitles[0] ?? input.topic,
      missionId,
    );

    // Step 5: Optional publish schedule. Caption keeps the approved affiliate
    // link from the description when one is present; a title alone is not a CTA.
    const title = script.primary.suggestedTitles[0] ?? input.topic;
    const caption = description.body.includes('http') ? `${title}\n\n${description.body}` : title;
    const publish = await scheduleMissionPublish(input, video, caption, missionId);

    const publishIncomplete = Boolean(
      publish && ('skipped' in publish || 'failed' in publish),
    );
    let status: AutoVideoMissionResult['status'] = 'succeeded';
    let blockReason: AutoVideoMissionResult['blockReason'];
    if (!video?.videoId) {
      status = 'blocked';
      blockReason = 'NO_BYOK';
    } else if (publishIncomplete) {
      status = 'blocked';
      blockReason = 'PUBLISH_FAILED';
    } else if (video.status !== 'completed') {
      // A submitted HeyGen job is a queued render, not a finished video.
      status = 'render_queued';
    }

    const result: AutoVideoMissionResult = {
      missionId,
      script,
      description,
      video,
      publish,
      status,
      ...(blockReason ? { blockReason } : {}),
    };

    if (status === 'succeeded') {
      await markMissionSucceeded(missionId, result);
    } else if (status === 'render_queued') {
      await markMissionInProgress(missionId, result);
    } else {
      await markMissionBlocked(missionId, blockReason ?? 'UNKNOWN', result);
    }
    return result;
  } catch (err) {
    if (err instanceof AutoVideoMissionError) {
      if (err.missionId) {
        await markMissionFailed(err.missionId, err.code, err.message);
      }
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    await markMissionFailed(missionId, 'PERSIST_FAILED', msg);
    throw new AutoVideoMissionError('PERSIST_FAILED', msg, missionId);
  }
}
