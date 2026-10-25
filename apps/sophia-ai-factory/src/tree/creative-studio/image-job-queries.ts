/**
 * Shared D1 read layer for image generation jobs.
 *
 * Both the authenticated API routes and the workspace server component use
 * these functions so ownership filtering and row mapping stay in one place.
 * Every read is scoped to `userId` — a job belonging to another tenant must
 * never be reachable by id.
 *
 * @module tree/creative-studio/image-job-queries
 */

import type { createServerClient } from '@/seed/db/client';

/** Column set read from `media_jobs` for image jobs. */
export interface ImageJobRow {
  id: string;
  user_id: string;
  model: string;
  prompt: string | null;
  status: string;
  result_url: string | null;
  thumbnail_url: string | null;
  provider: string | null;
  error: string | null;
  created_at: number;
  completed_at: number | null;
}

/** Row set shared by list and single-job reads, in API response order. */
const SELECT_COLUMNS =
  'id, user_id, model, prompt, status, result_url, thumbnail_url, provider, error, created_at, completed_at';

/** Narrow a raw D1 row to the typed shape, tolerating missing optional columns. */
export function toImageJobRow(raw: Record<string, unknown>): ImageJobRow {
  return {
    id: String(raw.id ?? ''),
    user_id: String(raw.user_id ?? ''),
    model: String(raw.model ?? ''),
    prompt: typeof raw.prompt === 'string' ? raw.prompt : null,
    status: String(raw.status ?? 'pending'),
    result_url: typeof raw.result_url === 'string' ? raw.result_url : null,
    thumbnail_url: typeof raw.thumbnail_url === 'string' ? raw.thumbnail_url : null,
    provider: typeof raw.provider === 'string' ? raw.provider : null,
    error: typeof raw.error === 'string' ? raw.error : null,
    created_at: Number(raw.created_at ?? 0),
    completed_at: typeof raw.completed_at === 'number' ? raw.completed_at : null,
  };
}

/** Newest-first image jobs owned by the user. */
export async function listUserImageJobs(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  limit = 50,
): Promise<ImageJobRow[]> {
  const { data, error } = (await db
    .from('media_jobs')
    .select(SELECT_COLUMNS)
    .eq('user_id', userId)
    .eq('type', 'image')
    .order('created_at', { ascending: false })
    .limit(limit)) as { data: ImageJobRow[] | null; error: { message: string } | null };

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toImageJobRow(row as unknown as Record<string, unknown>));
}

/**
 * A single image job owned by the user, or null when absent / not owned.
 * Ownership is enforced in the query so a foreign id is indistinguishable
 * from a missing one — no existence leak across tenants.
 */
export async function getUserImageJob(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  jobId: string,
): Promise<ImageJobRow | null> {
  const { data, error } = (await db
    .from('media_jobs')
    .select(SELECT_COLUMNS)
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle()) as { data: ImageJobRow | null; error: { message: string } | null };

  if (error) {
    throw new Error(error.message);
  }

  return data ? toImageJobRow(data as unknown as Record<string, unknown>) : null;
}
