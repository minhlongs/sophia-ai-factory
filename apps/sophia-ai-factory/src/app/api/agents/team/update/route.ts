import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { seedDefaultTeam } from '@/forest/agents/seed-default-team';
import { getAgentById, updateAgent, listAgents } from '@/forest/agents/repository';
import { z } from 'zod';

const Schema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  systemPrompt: z.string().min(10).max(4000).optional(),
  model: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    const { agentId, ...updates } = parsed.data;
    const team = await seedDefaultTeam(user.id);
    const existing = await getAgentById(agentId);
    if (!existing || existing.teamId !== team.id) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    await updateAgent(agentId, updates);
    const agents = await listAgents(team.id);
    return NextResponse.json({ success: true, team: { id: team.id, name: team.name, agents } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
