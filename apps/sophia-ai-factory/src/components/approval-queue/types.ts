export type Approval = {
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
};

export interface ApprovalQueueProps {
  workspaceId: string;
}
