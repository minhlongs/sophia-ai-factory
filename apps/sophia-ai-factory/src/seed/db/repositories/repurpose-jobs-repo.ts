import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface RepurposeJob {
  id: string;
  user_id: string;
  source_video_id: string;
  status: string;
  clip_manifest: string | null;
  total_clips: number;
  completed_clips: number;
  created_at: string;
}

export interface RepurposeClip {
  id: string;
  job_id: string;
  clip_index: number;
  start_ms: number;
  end_ms: number;
  score: number | null;
  title: string | null;
  status: string;
  output_video_id: string | null;
  created_at: string;
}

export async function createRepurposeJob(input: {
  userId: string;
  sourceVideoId: string;
}): Promise<RepurposeJob> {
  const db = await getD1Raw();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await db
    .prepare(
      `INSERT INTO repurpose_jobs (id, user_id, source_video_id)
       VALUES (?, ?, ?)`,
    )
    .bind(id, input.userId, input.sourceVideoId)
    .run();

  logger.info('[repurpose-jobs-repo] Created repurpose job', { id, userId: input.userId });
  return (await getRepurposeJob(id))!;
}

export async function getRepurposeJob(id: string): Promise<RepurposeJob | null> {
  const db = await getD1Raw();
  return db.prepare('SELECT * FROM repurpose_jobs WHERE id = ?').bind(id).first<RepurposeJob>() ?? null;
}

export async function listRepurposeJobs(userId: string): Promise<RepurposeJob[]> {
  const db = await getD1Raw();
  const result = await db
    .prepare('SELECT * FROM repurpose_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(userId)
    .all<RepurposeJob>();
  return result.results ?? [];
}

export async function updateRepurposeJobStatus(
  id: string,
  status: string,
  extra?: { clipManifest?: string; totalClips?: number },
): Promise<void> {
  const db = await getD1Raw();

  if (extra?.clipManifest !== undefined && extra?.totalClips !== undefined) {
    await db
      .prepare(
        'UPDATE repurpose_jobs SET status = ?, clip_manifest = ?, total_clips = ? WHERE id = ?',
      )
      .bind(status, extra.clipManifest, extra.totalClips, id)
      .run();
  } else if (extra?.clipManifest !== undefined) {
    await db
      .prepare('UPDATE repurpose_jobs SET status = ?, clip_manifest = ? WHERE id = ?')
      .bind(status, extra.clipManifest, id)
      .run();
  } else {
    await db
      .prepare('UPDATE repurpose_jobs SET status = ? WHERE id = ?')
      .bind(status, id)
      .run();
  }
}

export async function insertRepurposeClips(
  jobId: string,
  clips: Array<{
    clipIndex: number;
    startMs: number;
    endMs: number;
    score?: number;
    title?: string;
  }>,
): Promise<void> {
  const db = await getD1Raw();

  for (const clip of clips) {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await db
      .prepare(
        `INSERT INTO repurpose_clips (id, job_id, clip_index, start_ms, end_ms, score, title)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, jobId, clip.clipIndex, clip.startMs, clip.endMs, clip.score ?? null, clip.title ?? null)
      .run();
  }

  logger.info('[repurpose-jobs-repo] Inserted repurpose clips', { jobId, count: clips.length });
}

export async function getRepurposeClips(jobId: string): Promise<RepurposeClip[]> {
  const db = await getD1Raw();
  const result = await db
    .prepare('SELECT * FROM repurpose_clips WHERE job_id = ? ORDER BY clip_index ASC')
    .bind(jobId)
    .all<RepurposeClip>();
  return result.results ?? [];
}

export async function updateRepurposeClipStatus(
  clipId: string,
  status: string,
  outputVideoId?: string,
): Promise<void> {
  const db = await getD1Raw();

  if (outputVideoId) {
    await db
      .prepare('UPDATE repurpose_clips SET status = ?, output_video_id = ? WHERE id = ?')
      .bind(status, outputVideoId, clipId)
      .run();
  } else {
    await db
      .prepare('UPDATE repurpose_clips SET status = ? WHERE id = ?')
      .bind(status, clipId)
      .run();
  }
}

export async function incrementRepurposeProgress(jobId: string): Promise<void> {
  const db = await getD1Raw();
  await db
    .prepare(
      'UPDATE repurpose_jobs SET completed_clips = completed_clips + 1 WHERE id = ?',
    )
    .bind(jobId)
    .run();
}
