/**
 * Auto Video Mission Execution Service
 *
 * Layer: land
 *
 * @module land/missions/auto-video/auto-video-service
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  AutoVideoMissionError,
  type AutoVideoMissionInput,
  type AutoVideoMissionResult,
} from './types';
import { buildMissionScript, buildMissionDescription } from './prompt-builder';
import { submitMissionVideo, scheduleMissionPublish } from './mission-scheduler';

const COMMAND = 'auto-video';

function newMissionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function insertMissionRow(
  userId: string,
  params: AutoVideoMissionInput,
): Promise<string> {
  const id = newMissionId();
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `INSERT INTO engine_missions (id, user_id, command, params, status)
         VALUES (?, ?, ?, ?, 'running')`,
      )
      .bind(id, userId, COMMAND, JSON.stringify({ ...params, userId: undefined }))
      .run();
    return id;
  } catch (err) {
    logger.error('[auto-video-mission] insertMissionRow failed', toError(err), { userId });
    throw new AutoVideoMissionError('PERSIST_FAILED', 'Could not create mission row');
  }
}

async function markMissionFailed(missionId: string, errCode: string, errMessage: string): Promise<void> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `UPDATE engine_missions
         SET status='failed', error=?, updated_at=strftime('%s','now')
         WHERE id=?`,
      )
      .bind(JSON.stringify({ code: errCode, message: errMessage }), missionId)
      .run();
  } catch (err) {
    logger.error('[auto-video-mission] markMissionFailed failed', toError(err), { missionId });
  }
}

async function markMissionSucceeded(missionId: string, result: AutoVideoMissionResult): Promise<void> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `UPDATE engine_missions
         SET status='succeeded', result=?, completed_at=strftime('%s','now'), updated_at=strftime('%s','now')
         WHERE id=?`,
      )
      .bind(JSON.stringify(result), missionId)
      .run();
  } catch (err) {
    logger.error('[auto-video-mission] markMissionSucceeded failed', toError(err), { missionId });
  }
}

/** End-to-end autonomous mission. Persists progress; throws AutoVideoMissionError on any failure. */
export async function runAutoVideoMission(
  input: AutoVideoMissionInput,
): Promise<AutoVideoMissionResult> {
  if (!input.topic?.trim()) {
    throw new AutoVideoMissionError('EMPTY_TOPIC', 'topic is required');
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
