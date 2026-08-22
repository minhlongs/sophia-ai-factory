/**
 * Canonical memory/registry contracts — 4 interfaces.
 *
 * CONTRACTS ONLY: method signatures + return types, no implementation.
 * Entities are referenced from `@/seed/types/creative-domain` — never redefined.
 *
 * @module seed/types/creative-economy/interfaces-memory
 */

import type {
  CreativeMemory,
  IP,
  PerformanceSnapshot,
  PerformanceEvent,
  RevenueEvent,
} from '@/seed/types/creative-domain'
import type { Result } from '@/seed/types/result'
import type {
  CreativeMemoryEntryId,
  IntellectualPropertyId,
  PerformanceSnapshotId,
} from './ids'

// ─── ICreativeMemoryStore ────────────────────────────────────────────────────

export interface MemoryQuery {
  workspaceId: string
  category?: 'identity' | 'creative' | 'audience' | 'performance' | 'business' | 'operational' | 'provenance'
  key?: string
  scope?: 'global' | 'campaign' | 'project' | 'channel'
  scopeId?: string
  limit?: number
}

export interface MemorySummary {
  entries: CreativeMemory[]
  total: number
}

export interface ICreativeMemoryStore {
  /** Read a single entry by branded id. */
  get(id: CreativeMemoryEntryId): Promise<Result<CreativeMemory, Error>>
  /** Query entries by workspace + optional filters. */
  query(query: MemoryQuery): Promise<Result<MemorySummary, Error>>
  /** Insert or update an entry; bumps version and rewrites evidence. */
  put(entry: Omit<CreativeMemory, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<Result<CreativeMemoryEntryId, Error>>
  /** Soft-delete an entry (sets isDeleted). */
  delete(id: CreativeMemoryEntryId): Promise<Result<boolean, Error>>
  /** Summarize a slice of memory into a compact text block for agent context. */
  summarize(query: MemoryQuery, maxTokens: number): Promise<Result<string, Error>>
}

// ─── IIntellectualPropertyRegistry ───────────────────────────────────────────

export interface IPQuery {
  workspaceId: string
  type?: 'universe' | 'world' | 'series' | 'character' | 'theme' | 'brand'
  name?: string
  parentId?: string
}

export interface IPRegistryResult {
  ip: IP
  lineage: IP[] // root → immediate parent → ip
}

export interface IIntellectualPropertyRegistry {
  register(ip: Omit<IP, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<IntellectualPropertyId, Error>>
  get(id: IntellectualPropertyId): Promise<Result<IP, Error>>
  query(query: IPQuery): Promise<Result<IP[], Error>>
  /** Walk parent chain to root; returns empty lineage for orphans. */
  getLineage(id: IntellectualPropertyId): Promise<Result<IP[], Error>>
  /** Children of a given node (direct only). */
  getChildren(id: IntellectualPropertyId): Promise<Result<IP[], Error>>
}

// ─── IContentGraph ───────────────────────────────────────────────────────────

export interface IContentGraph {
  /** Link a story to the concept it was derived from. */
  attachStoryToConcept(storyId: string, conceptId: string): Promise<Result<boolean, Error>>
  /** Link a character IP to a story. */
  attachCharacterToStory(storyId: string, characterId: string): Promise<Result<boolean, Error>>
  /** Record that asset B was derived from asset A. */
  recordDerivative(sourceAssetId: string, derivativeAssetId: string, type: string): Promise<Result<boolean, Error>>
  /** All assets derived from a source (transitive closure, bounded). */
  getDerivatives(sourceAssetId: string, maxDepth?: number): Promise<Result<string[], Error>>
  /** All characters appearing in a story. */
  getStoryCharacters(storyId: string): Promise<Result<string[], Error>>
  /** All concepts attached to a story. */
  getStoryConcepts(storyId: string): Promise<Result<string[], Error>>
}

// ─── IPerformanceStore ───────────────────────────────────────────────────────

export interface PerformanceQuery {
  workspaceId: string
  assetId?: string
  projectId?: string
  channel?: string
  from?: number
  to?: number
  limit?: number
}

export interface IPerformanceStore {
  recordEvent(event: Omit<PerformanceEvent, 'id'>): Promise<Result<string, Error>>
  recordSnapshot(snapshot: Omit<PerformanceSnapshot, 'id'>): Promise<Result<PerformanceSnapshotId, Error>>
  querySnapshots(query: PerformanceQuery): Promise<Result<PerformanceSnapshot[], Error>>
  queryEvents(query: PerformanceQuery): Promise<Result<PerformanceEvent[], Error>>
  /** Aggregate revenue by channel for a workspace within a window. */
  revenueByChannel(workspaceId: string, from: number, to: number): Promise<Result<Record<string, number>, Error>>
  /** Aggregate revenue by asset for a workspace within a window. */
  revenueByAsset(workspaceId: string, from: number, to: number): Promise<Result<Record<string, number>, Error>>
  /** Latest revenue event for an asset, if any. */
  latestRevenue(assetId: string): Promise<Result<RevenueEvent | null, Error>>
}