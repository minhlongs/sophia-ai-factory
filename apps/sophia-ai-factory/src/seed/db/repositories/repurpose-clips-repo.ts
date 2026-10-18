import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

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
const db = await getD1();
if (!db || clips.length === 0) return;

const stmt = db.prepare(
`INSERT INTO repurpose_clips (id, job_id, clip_index, start_ms, end_ms, score, title)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
);
const batch = clips.map((clip) => {
const clipId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
return stmt.bind(clipId, jobId, clip.clipIndex, clip.startMs, clip.endMs, clip.score ?? null, clip.title ?? null);
});
await db.batch(batch);

logger.info('[repurpose-jobs-repo] Inserted repurpose clips', { jobId, count: clips.length });
}

export async function getRepurposeClips(jobId: string): Promise<RepurposeClip[]> {
const db = await getD1();
if (!db) return [];
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
const db = await getD1();
if (!db) return;

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
