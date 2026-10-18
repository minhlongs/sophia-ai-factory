import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
type RepurposeClip,
insertRepurposeClips,
getRepurposeClips,
updateRepurposeClipStatus,
} from './repurpose-clips-repo';

export type { RepurposeClip };
export { insertRepurposeClips, getRepurposeClips, updateRepurposeClipStatus };

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

export async function createRepurposeJob(input: {
userId: string;
sourceVideoId: string;
}): Promise<RepurposeJob> {
const db = await getD1();
if (!db) throw new Error('Database unavailable');
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
const db = await getD1();
if (!db) return null;
return db.prepare('SELECT * FROM repurpose_jobs WHERE id = ?').bind(id).first<RepurposeJob>() ?? null;
}

export async function listRepurposeJobs(userId: string): Promise<RepurposeJob[]> {
const db = await getD1();
if (!db) return [];
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
const db = await getD1();
if (!db) return;

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

export async function incrementRepurposeProgress(jobId: string): Promise<void> {
const db = await getD1();
if (!db) return;
await db
.prepare(
'UPDATE repurpose_jobs SET completed_clips = completed_clips + 1 WHERE id = ?',
)
.bind(jobId)
.run();
}
