/**
 * Multi-Asset Clearing Constants & Enums
 *
 * Layer: seed/types
 */

export const CLEARING_ASSETS = ['USDT', 'USDC', 'EUR', 'JPY', 'SGD', 'VND', 'USD'] as const;
export type ClearingAsset = (typeof CLEARING_ASSETS)[number];

export const POOL_STATUSES = ['active', 'rebalancing', 'depleted', 'halted', 'emergency_pause'] as const;
export type PoolStatus = (typeof POOL_STATUSES)[number];

export const BATCH_CYCLES = ['instant_rtgs', 'hourly_netting', 'eod_reconciliation'] as const;
export type BatchCycle = (typeof BATCH_CYCLES)[number];

export const SETTLEMENT_TYPES = ['T0_RTGS', 'NET_DEFERRED', 'INSTANT_CRYPTO'] as const;
export type SettlementType = (typeof SETTLEMENT_TYPES)[number];

export const RECONCILIATION_STATUSES = ['pending', 'matched', 'discrepancy', 'manually_resolved', 'reconciled'] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export const CLEARING_BATCH_STATUSES = ['queued', 'processing', 'cleared', 'reconciled', 'settled', 'failed', 'rejected'] as const;
export type ClearingBatchStatus = (typeof CLEARING_BATCH_STATUSES)[number];

export const CONSENSUS_PROTOCOLS = ['RAFT_BFT', 'PBFT_FAST', 'RAFT_FAILOVER'] as const;
export type ConsensusProtocol = (typeof CONSENSUS_PROTOCOLS)[number];

/** Strict invariant: Maximum slippage tolerance is capped at 0.05% (5 basis points) */
export const MAX_SLIPPAGE_TOLERANCE_PCT = 0.05;

/** Sub-10ms heartbeat latency target for Raft-BFT consensus */
export const SUB_10MS_HEARTBEAT_THRESHOLD_MS = 10.0;
