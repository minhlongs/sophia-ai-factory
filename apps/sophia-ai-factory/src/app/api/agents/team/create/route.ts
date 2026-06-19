import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { seedDefaultTeam } from '@/tree/agents/seed-default-team';
import { createAgent, listAgents } from '@/tree/agents/repository';
import { z } from 'zod';

const Schema = z.object({
  role: z.enum(['CEO', 'Developer', 'QA', 'Ops', 'Marketing']),
  name: z.string().min(1).max(100),
  systemPrompt: z.string().min(10).max(4000),
  model: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const team = await seedDefaultTeam(user.id);
    await createAgent({ teamId: team.id, ...parsed.data });
    const agents = await listAgents(team.id);
    return NextResponse.json({ success: true, team: { id: team.id, name: team.name, agents } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
