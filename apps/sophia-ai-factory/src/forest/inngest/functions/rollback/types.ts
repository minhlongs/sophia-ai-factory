import type { getD1 } from '@/seed/db/client'

export const DEFAULT_MAX_AUTO_RETRIES = 3
export const SCAN_LIMIT = 100

export type D1Database = NonNullable<Awaited<ReturnType<typeof getD1>>>

export type PolicyCaps = Map<string, Map<string, number>>

export interface FailedRun {
  id: string
  agentId: string
  missionId: string | null
  workspaceId: string
  autonomyLevel: number
  retryCount: number
  endedAt: number | null
  errorMessage: string
  inputJson?: Record<string, unknown>
  missionType: string | null
}

export interface PolicyRow {
  workspaceId: string
  missionType: string
  maxAutoRetries: number
}

export type RowOutcome = 'retried' | 'cancelled' | 'skipped'
