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
  markMissionFailed,
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

    // Step 5: Optional publish schedule
    const publish = await scheduleMissionPublish(
      input,
      video,
      script.primary.suggestedTitles[0] ?? input.topic,
      missionId,
    );

    const result: AutoVideoMissionResult = {
      missionId,
      script,
      description,
      video,
      publish,
      status: 'succeeded',
    };

    await markMissionSucceeded(missionId, result);
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
