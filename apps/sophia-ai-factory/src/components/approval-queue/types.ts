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
  niche?: 'crypto_global' | 'saas_global' | 'ecommerce_vn' | string;
  jurisdiction?: string;
  approvalPayloadHash?: string;
  complianceStatus?: 'passed' | 'blocked' | 'review';
};

export interface ApprovalQueueProps {
  workspaceId: string;
}
