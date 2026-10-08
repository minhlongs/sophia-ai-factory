export interface VideoAnalytics {
    id: string;
    videoId: string;
    views: number;
    clicks: number;
    conversions: number;
    revenueGenerated: number;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}

export type AttributionLedgerStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface AttributionLedgerEntry {
    id: string;
    organizationId: string;
    videoId: string;
    sourcePlatform: string;
    conversionValue: number;
    status: AttributionLedgerStatus;
    attributedAt: number;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}

export interface RenderBudgetConfig {
    minRoiMultiplier: number; // e.g. target LTV must be >= X * cost
    defaultRenderCost: number; // cost equivalent to render 1 unit
    maxAllocatedBudget: number; // cap
}

export interface AttributionCreationCommand {
    organizationId: string;
    videoId: string;
    sourcePlatform: string;
    conversionValue: number;
    metadata?: Record<string, unknown>;
}
