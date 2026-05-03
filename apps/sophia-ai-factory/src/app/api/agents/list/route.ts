/**
 * GET /api/agents/list — List tenant's agents with derived status
 * Status derived from agent_tasks in last 30s.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import type { AgentRow, AgentTaskRow } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'error';

export interface AgentWithStatus {
  id: string;
  role: string;
  name: string;
  status: AgentStatus;
  currentTask: string | null;
  lastActiveAt: string | null;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = createServerClient();
    const orgId = user.id;

    // Get team for org
    const { data: teamData } = await db
      .from('agent_teams')
      .select('id')
      .eq('org_id', orgId)
      .maybeSingle();

    if (!teamData) {
      return NextResponse.json({ agents: [] });
    }

    // Get agents for team
    const { data: agentRows } = await db
      .from('agents')
      .select('id, role, name, created_at')
      .eq('team_id', (teamData as { id: string }).id)
      .eq('enabled', 1);

    if (!agentRows || agentRows.length === 0) {
      return NextResponse.json({ agents: [] });
    }

    const agentIds = (agentRows as unknown as AgentRow[]).map(a => a.id);
    const threshold = new Date(Date.now() - 30_000).toISOString();

    // Get recent tasks to derive status
    const { data: recentTasks } = await db
      .from('agent_tasks')
      .select('agent_id, status, input, created_at')
      .eq('org_id', orgId)
      .in('agent_id', agentIds)
      .gt('created_at', threshold)
      .order('created_at', { ascending: false });

    // Build agent-id → latest task map
    const taskMap = new Map<string, AgentTaskRow>();
    if (recentTasks) {
      for (const task of recentTasks as unknown as AgentTaskRow[]) {
        if (!taskMap.has(task.agent_id)) {
          taskMap.set(task.agent_id, task);
        }
      }
    }

    const agents: AgentWithStatus[] = (agentRows as unknown as AgentRow[]).map(agent => {
      const task = taskMap.get(agent.id);
      let status: AgentStatus = 'idle';
      if (task) {
        if (task.status === 'running') status = 'working';
        else if (task.status === 'failed') status = 'error';
      }
      return {
        id: agent.id,
        role: agent.role,
        name: agent.name,
        status,
        currentTask: task ? task.input.slice(0, 80) : null,
        lastActiveAt: task ? task.created_at : null,
      };
    });

    return NextResponse.json({ agents });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
