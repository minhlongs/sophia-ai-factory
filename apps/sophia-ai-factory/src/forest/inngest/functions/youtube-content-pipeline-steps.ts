/**
 * YouTube content pipeline DB and checkpoint step executors.
 *
 * Layer: forest (imports seed only; zero land imports).
 *
 * @module forest/inngest/functions/youtube-content-pipeline-steps
 */

import { getD1Sync } from '@/seed/db/client';

export interface LoadedChannelConfig {
  objective: string;
  audience: string;
  contentPillars: string[];
  cadence: string;
  postsPerWeek: number;
  bufferDays: number;
  autonomyLevel: number;
}

export interface PipelineCheckpointWriter {
  saveGenerationCheckpoint(
    jobId: string,
    stage: 'strategy' | 'script' | 'seo',
    data: {
      status: 'completed';
      artifact: Record<string, unknown>;
      completedAt: string;
    },
  ): Promise<unknown>;
}

export async function loadChannelConfigSnapshot(
  channelConfigId: string,
  userId: string,
): Promise<LoadedChannelConfig> {
  const db = getD1Sync();
  const row = await db
    .prepare(`SELECT * FROM youtube_channel_configs WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(channelConfigId, userId)
    .first<Record<string, unknown>>();
  if (!row) throw new Error(`Channel config not found: ${channelConfigId}`);
  let pillars: string[] = [];
  try {
    const parsed = JSON.parse(String(row.content_pillars ?? '[]'));
    if (Array.isArray(parsed)) pillars = parsed.map((v) => String(v));
  } catch {
    pillars = [];
  }
  return {
    objective: String(row.objective),
    audience: String(row.audience),
    contentPillars: pillars,
    cadence: String(row.cadence),
    postsPerWeek: Number(row.posts_per_week) || 3,
    bufferDays: Number(row.content_buffer_days) || 3,
    autonomyLevel: Number(row.autonomy_level) || 2,
  };
}

export async function savePipelineCheckpoints(params: {
  store: PipelineCheckpointWriter | null;
  jobId: string;
  strategy: unknown;
  script: unknown;
  seo: unknown;
}): Promise<{ saved: boolean }> {
  const { store, jobId, strategy, script, seo } = params;
  if (!store) return { saved: false };
  const completedAt = new Date().toISOString();
  await store.saveGenerationCheckpoint(jobId, 'strategy', {
    status: 'completed',
    artifact: strategy as Record<string, unknown>,
    completedAt,
  });
  await store.saveGenerationCheckpoint(jobId, 'script', {
    status: 'completed',
    artifact: script as Record<string, unknown>,
    completedAt,
  });
  await store.saveGenerationCheckpoint(jobId, 'seo', {
    status: 'completed',
    artifact: seo as Record<string, unknown>,
    completedAt,
  });
  return { saved: true };
}

export async function insertYoutubeCalendarEntry(params: {
  id: string;
  userId: string;
  channelConfigId: string;
  title: string;
  contentType: string;
  jobId: string;
}): Promise<string> {
  const { id, userId, channelConfigId, title, contentType, jobId } = params;
  const db = getD1Sync();
  await db
    .prepare(
      `INSERT INTO youtube_content_calendar
       (id, user_id, channel_config_id, title, content_type, status, scheduled_at, notes)
       VALUES (?1,?2,?3,?4,?5,'scheduled',datetime('now'),?6)`,
    )
    .bind(id, userId, channelConfigId, title, contentType, `Pipeline ${jobId}`)
    .run();
  return id;
}
