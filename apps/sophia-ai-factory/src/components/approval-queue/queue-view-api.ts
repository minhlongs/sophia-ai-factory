'use client';

import type { Approval } from './types';

export async function fetchWorkspaceApprovals(workspaceId: string): Promise<Approval[]> {
  const params = new URLSearchParams({ workspaceId, limit: '50', offset: '0' });
  const res = await fetch(`/api/approvals?${params.toString()}`, {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error((body.error as string) || `HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    approvals: Array<{
      id: string;
      agentId: string;
      actionId: string;
      actionType: string;
      actionSummary: string;
      estimatedCostCents?: number | null;
      status: string;
      createdAt: number;
      timeoutAt: number;
      missionId?: string | null;
      workspaceId?: string;
    }>;
  };
  return data.approvals.map((a) => ({
    ...a,
    workspaceId: a.workspaceId ?? workspaceId,
  }));
}

export async function submitApprovalResolution(
  approvalId: string,
  approved: boolean,
  reason?: string
): Promise<void> {
  const res = await fetch(`/api/approvals/${approvalId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ approved, reason }),
  });

  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.error as string) || (body.details as string) || `HTTP ${res.status}`);
  }
}
