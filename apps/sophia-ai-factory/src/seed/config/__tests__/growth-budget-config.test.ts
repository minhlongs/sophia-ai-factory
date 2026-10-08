import { describe, it, expect } from 'vitest';
import { isBudgetViable, DEFAULT_BUDGET_CONFIG } from '../growth-budget-config';

describe('Growth Budget Config', () => {
    it('should require minimum ROI', () => {
        const targetMultiplier = DEFAULT_BUDGET_CONFIG.minRoiMultiplier;
        const defaultCost = DEFAULT_BUDGET_CONFIG.defaultRenderCost;
        
        // Exact threshold should pass
        expect(isBudgetViable(defaultCost * targetMultiplier)).toBe(true);
        
        // Below threshold should fail
        expect(isBudgetViable((defaultCost * targetMultiplier) - 0.01)).toBe(false);
        
        // Above threshold should pass
        expect(isBudgetViable(defaultCost * (targetMultiplier + 1))).toBe(true);
    });
});
