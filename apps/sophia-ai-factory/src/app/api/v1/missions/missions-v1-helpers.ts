/**
 * Schemas and pagination query helper for /api/v1/missions.
 * @module app/api/v1/missions/missions-v1-helpers
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';

export const CreateMissionSchema = z.object({
  command: z.string().min(1).max(100),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  webhook_url: z.string().url().optional(),
});

export const ListQuerySchema = z.object({
  status: z.string().optional(),
  command: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export async function listUserMissionsPaginated(
  userId: string,
  searchParams: URLSearchParams,
): Promise<NextResponse> {
  const queryParsed = ListQuerySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    command: searchParams.get('command') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
  });

  if (!queryParsed.success) {
    return NextResponse.json({ error: 'Invalid query params' }, { status: 400 });
  }

  const { status, command, limit, cursor } = queryParsed.data;
  const db = createServerClient();

  let query = db
    .from('engine_missions')
    .select('id, command, status, credits_used, created_at, completed_at, webhook_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (status) query = query.eq('status', status);
  if (command) query = query.eq('command', command);
  if (cursor) query = query.lt('created_at', Number(cursor));

  const { data } = (await query) as { data: Array<Record<string, unknown>> | null; error: unknown };
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  const nextCursor = hasMore && rows.length > 0 ? String(rows[rows.length - 1].created_at) : null;

  return NextResponse.json({
    missions: rows,
    has_more: hasMore,
    next_cursor: nextCursor,
  });
}
