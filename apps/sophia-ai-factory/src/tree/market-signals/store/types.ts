/**
 * Market Signals Database Types and Contracts
 *
 * Layer: tree/market-signals/store
 */

import type { MarketSignal, SignalType } from '@/seed/types/creative-domain';
import { createMarketSignalId } from '@/seed/types/creative-economy/ids';

export interface MarketSignalRow {
  id: string;
  workspace_id: string;
  type: SignalType;
  source: string;
  title: string;
  summary: string;
  data: string; // JSON string
  confidence: number;
  relevance_score: number;
  expires_at: number | null;
  consumed: number;
  created_at: number;
}

export function rowToSignal(row: MarketSignalRow): MarketSignal {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    source: row.source,
    title: row.title,
    summary: row.summary,
    data: JSON.parse(row.data),
    confidence: row.confidence,
    relevanceScore: row.relevance_score,
    expiresAt: row.expires_at ?? undefined,
    consumed: row.consumed === 1,
    createdAt: row.created_at,
  };
}

export function signalToRow(signal: MarketSignal): MarketSignalRow {
  return {
    id: signal.id,
    workspace_id: signal.workspaceId,
    type: signal.type,
    source: signal.source,
    title: signal.title,
    summary: signal.summary,
    data: JSON.stringify(signal.data),
    confidence: signal.confidence,
    relevance_score: signal.relevanceScore,
    expires_at: signal.expiresAt ?? null,
    consumed: signal.consumed ? 1 : 0,
    created_at: signal.createdAt,
  };
}

/** Input for creating a signal. id / createdAt / consumed are optional and defaulted. */
export type CreateSignalInput = Omit<MarketSignal, 'id' | 'createdAt' | 'consumed'> & {
  id?: string;
  createdAt?: number;
  consumed?: boolean;
};

export function normalizeSignal(input: CreateSignalInput): MarketSignal {
  return {
    ...input,
    id: input.id ?? createMarketSignalId(),
    createdAt: input.createdAt ?? Date.now(),
    consumed: input.consumed ?? false,
  };
}
