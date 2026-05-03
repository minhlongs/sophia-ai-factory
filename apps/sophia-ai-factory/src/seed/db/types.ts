/**
 * Shared generic types for the D1 query layer.
 *
 * Keep this file free of runtime code — interfaces and type aliases only.
 */

/** Generic D1 query response shape for `.single()` / raw-chain awaits. */
export type D1Response<T> = {
  data: T | null
  error: unknown
}

// ── Agent Factory table row types ─────────────────────────────────────────

export type AgentTeamDbRow = {
  id: string
  org_id: string
  name: string
  config: string
  created_at: string
  updated_at: string
}

export type AgentDbRow = {
  id: string
  team_id: string
  role: 'CEO' | 'Developer'
  name: string
  system_prompt: string
  model: string
  enabled: number
  created_at: string
}

export type AgentTaskDbRow = {
  id: string
  org_id: string
  agent_id: string
  input: string
  output: string | null
  status: 'queued' | 'running' | 'completed' | 'failed'
  error_message: string | null
  tokens_used: number
  cost_usd: number
  created_at: string
  completed_at: string | null
}

export type AgentLogDbRow = {
  id: string
  task_id: string
  action: string
  payload: string
  created_at: string
}
