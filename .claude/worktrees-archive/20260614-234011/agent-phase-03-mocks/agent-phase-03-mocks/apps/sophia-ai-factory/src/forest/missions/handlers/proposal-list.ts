/**
 * Handler: proposal:list
 *
 * Lists the user's saved proposals from the proposals table.
 * LIVE — no external API call.
 */

import { createServerClient } from '@/seed/db/client';
import type { MissionHandlerResult, MissionContext } from './types';

interface ProposalRow {
  id: string;
  title: string;
  niche: string | null;
  status: string;
  created_at: string;
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId, params } = ctx;
  const limit = Math.min(Number(params?.limit ?? 20), 100);

  const db = createServerClient();
  const { data } = await db
    .from('proposals')
    .select('id, title, niche, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit) as { data: ProposalRow[] | null; error: unknown };

  return {
    ok: true,
    data: {
      proposals: data ?? [],
      total: (data ?? []).length,
    },
  };
}
