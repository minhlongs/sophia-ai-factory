export interface RevenueAttributionRow {
  workspaceId: string;
  contentProjectId: string;
  contentAssetId: string | null;
  channel: string;
  network: string;
  clicks: number;
  conversions: number;
  revenueCents: number;
  costCents: number;
  roi: number;
  attributedAt: number;
}

/** Per-content-project attribution row (unit-level ROI) */
export interface ContentUnitAttribution {
  contentProjectId: string;
  workspaceId: string;
  title: string;
  channel: string;
  clicks: number;
  conversions: number;
  revenueCents: number;
  costCents: number;
  roi: number;
  events: number;
}

export type UnitRow = {
  content_project_id: string;
  workspace_id: string;
  title: string;
  channel: string;
  clicks: number;
  conversions: number;
  revenue_cents: number;
  cost_cents: number;
  roi: number;
  events: number;
};

export const EMPTY: RevenueAttributionRow[] = [];
export const EMPTY_UNIT: ContentUnitAttribution[] = [];
