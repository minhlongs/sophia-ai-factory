import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { seedDefaultTeam } from '@/forest/agents/seed-default-team';
import { listAgents } from '@/forest/agents/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const team = await seedDefaultTeam(user.id);
    const agents = await listAgents(team.id);
    return NextResponse.json({ success: true, team: { id: team.id, name: team.name, agents } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
