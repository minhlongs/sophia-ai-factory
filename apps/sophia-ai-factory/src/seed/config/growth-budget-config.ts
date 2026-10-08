import type { RenderBudgetConfig } from '../types/growth-triad';

export const DEFAULT_BUDGET_CONFIG: RenderBudgetConfig = {
    minRoiMultiplier: 2.5, // require projected LTV to be 2.5x the generation cost
    defaultRenderCost: 0.05, // e.g. $0.05 per standard credit/render
    maxAllocatedBudget: 100.00, // $100 cap per campaign day
};

/**
 * Validates if a proposed render passes the basic economic threshold.
 */
export function isBudgetViable(expectedValue: number, cost: number = DEFAULT_BUDGET_CONFIG.defaultRenderCost): boolean {
    if (cost <= 0) return true; // free is always viable
    return expectedValue >= cost * DEFAULT_BUDGET_CONFIG.minRoiMultiplier;
}
