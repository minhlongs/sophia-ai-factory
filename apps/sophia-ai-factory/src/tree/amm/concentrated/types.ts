/**
 * Concentrated Liquidity AMM Engine Types
 * Layer: TREE (Business Logic)
 */

export {
  AMM_CONSTANTS,
  type AmmLiquidityPool,
  type AmmSwapTransaction,
  type AmmSwapQuoteRequest,
  type AmmSwapQuoteResult,
  rowToAmmLiquidityPool,
} from '@/seed/types/amm-clearing';

export interface ExecuteSwapResult {
  transaction: import('@/seed/types/amm-clearing').AmmSwapTransaction;
  updatedPool: import('@/seed/types/amm-clearing').AmmLiquidityPool;
}
