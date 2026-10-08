import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { getLatestCustomerPredictiveScore } from '@/tree/predictive/predictive-ltv-engine';

export interface BudgetRouterRequest {
  customerId: string;
  requestedCostCents: number;
}

export interface BudgetRouterDecision {
  allowed: boolean;
  reason: string;
  ltvScore: number;
}

export type BudgetRouterError = {
  code: string;
  message: string;
};

/**
 * Serverless Budget Router (Interceptor)
 * Enforces quota constraints based on Tree LTV scores before heavy API calls.
 */
export async function enforceLtvBudgetConstraints(
  db: D1Database,
  request: BudgetRouterRequest
): Promise<Result<BudgetRouterDecision, BudgetRouterError>> {
  if (!request.customerId) {
    return failure({
      code: 'MISSING_CUSTOMER_ID',
      message: 'Customer ID is required for budget routing.'
    });
  }

  if (request.requestedCostCents <= 0) {
    return success({
      allowed: true,
      reason: 'No cost associated with request.',
      ltvScore: 0
    });
  }

  // Fetch the latest LTV score for the customer
  const score = await getLatestCustomerPredictiveScore(db, request.customerId);
  if (!score) {
    return failure({
      code: 'NO_PREDICTIVE_SCORE',
      message: 'No predictive LTV score found for customer.'
    });
  }

  // Basic symmetrical routing heuristic:
  // If the request cost is greater than a certain fraction of their predicted LTV, or if they are critical risk, deny.
  if (score.riskLevel === 'critical') {
    return success({
      allowed: false,
      reason: 'Budget router intercepted: Customer is at critical churn risk.',
      ltvScore: score.forecastLtv24mCents
    });
  }

  // 1% of predicted LTV as a very basic cap per operation limit
  const maxAllowedStipend = Math.max(500, score.forecastLtv24mCents * 0.01);
  if (request.requestedCostCents > maxAllowedStipend) {
    return success({
      allowed: false,
      reason: `Budget router intercepted: Request cost (${request.requestedCostCents}¢) exceeds max allowed stipend (${maxAllowedStipend}¢) based on LTV.`,
      ltvScore: score.forecastLtv24mCents
    });
  }

  return success({
    allowed: true,
    reason: 'Approved by LTV budget router.',
    ltvScore: score.forecastLtv24mCents
  });
}
