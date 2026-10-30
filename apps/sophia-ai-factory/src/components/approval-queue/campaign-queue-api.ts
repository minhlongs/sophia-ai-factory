'use client';

export type CampaignApprovalStatus =
  | 'pending_ceo'
  | 'approved'
  | 'rejected'
  | 'revoked'
  | 'expired'
  | 'invalidated_by_mutation'
  | 'executed'
  | 'aborted_by_kill_switch';

export interface CampaignApprovalItem {
  id: string;
  campaignId: string;
  niche: string | null;
  jurisdiction: string | null;
  status: CampaignApprovalStatus;
  approvalPayloadHash: string;
  approvedBy: string | null;
  approvedAt: number | null;
  expiresAt: number | null;
  revokedBy: string | null;
  revokedAt: number | null;
  executedAt: number | null;
  rejectionReason: string | null;
  createdAt: number | null;
  payload: {
    scriptBody?: string;
    affiliateTargetUrl?: string;
    jurisdiction?: string;
    disclosureText?: string;
    maxRenderCostCents?: number;
    targetAccount?: string;
  } | null;
}

export type CampaignApprovalAction = 'approve' | 'reject' | 'revoke' | 'resume';

export async function fetchCampaignApprovals(workspaceId: string): Promise<CampaignApprovalItem[]> {
  const params = new URLSearchParams({ workspaceId, limit: '50', offset: '0' });
  const res = await fetch(`/api/campaign-approvals?${params.toString()}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error((body.error as string) || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { approvals: CampaignApprovalItem[] };
  return data.approvals;
}

export async function submitCampaignApprovalAction(
  approvalId: string,
  action: CampaignApprovalAction,
  reason?: string,
): Promise<{ status: string; continuation?: string; resumed?: boolean }> {
  const res = await fetch(`/api/campaign-approvals/${approvalId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ action, reason }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((body.error as string) || (body.details as string) || `HTTP ${res.status}`);
  }
  return {
    status: body.status as string,
    continuation: body.continuation as string | undefined,
    resumed: body.resumed as boolean | undefined,
  };
}
