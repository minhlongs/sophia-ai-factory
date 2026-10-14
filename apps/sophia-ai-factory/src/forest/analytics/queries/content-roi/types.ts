/** Per-channel ROI breakdown within a single ContentProject */
export interface ChannelRoi {
  channel: string;
  revenueCents: number;
  costCents: number;
  roi: number;
  events: number;
}

/** Complete ROI snapshot for one ContentProject */
export interface ContentProjectRoi {
  workspaceId: string;
  contentProjectId: string;
  title: string;
  budgetCents: number;
  totalRevenueCents: number;
  totalCostCents: number;
  roi: number;
  events: number;
  channels: ChannelRoi[];
  hasData: boolean;
}

/** Workspace-level aggregated ROI across all ContentProjects */
export interface WorkspaceContentRoi {
  workspaceId: string;
  projects: ContentProjectRoi[];
  totalRevenueCents: number;
  totalCostCents: number;
  roi: number;
  hasData: boolean;
}

export const EMPTY_WORKSPACE: WorkspaceContentRoi = {
  workspaceId: '',
  projects: [],
  totalRevenueCents: 0,
  totalCostCents: 0,
  roi: 0,
  hasData: false,
};

export type RoiRow = {
  content_project_id: string;
  title: string;
  budget_cents: number;
  revenue_cents: number;
  cost_cents: number;
  roi: number;
  events: number;
  channel: string;
  workspace_id: string;
  ch_revenue: number | null;
  ch_cost: number | null;
  ch_roi: number | null;
  ch_events: number | null;
};
