/**
 * D1 Persistence Helpers for Auto Video Mission Execution
 *
 * Layer: land
 *
 * @module land/missions/auto-video/auto-video-persistence
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  AutoVideoMissionError,
  type AutoVideoMissionInput,
  type AutoVideoMissionResult,
} from './types';

const COMMAND = 'auto-video';

function newMissionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function insertMissionRow(
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

export async function markMissionFailed(
  missionId: string,
  errCode: string,
  errMessage: string,
): Promise<void> {
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

export async function markMissionSucceeded(
  missionId: string,
  result: AutoVideoMissionResult,
): Promise<void> {
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
