/**
 * @sophia/raas-sdk — Public types mirroring the RaaS API contract.
 * Source of truth: types/raas.ts in the sophia-proposal app.
 */

// ── Unions / Enums ────────────────────────────────────────────────────────────

export type MissionStatus =
  | 'queued'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed';

export type MissionPriority = 'low' | 'normal' | 'high' | 'urgent';

export type MissionCommand =
  | 'proposal:create'
  | 'video:create'
  | 'affiliate:generate'
  | 'affiliate:scrape'
  | 'content:blog'
  | 'content:social'
  | 'crm:sync'
  | 'analytics:export'
  | 'gtm:campaign'
  | 'sales:battlecard'
  | 'sales:proposal-deck'
  | 'sales:roi-calculator'
  | 'sales:competitor-analysis'
  | 'sales:pricing-optimizer'
  | 'sales:outreach-sequence'
  | (string & Record<never, never>); // allow custom commands without losing autocomplete

// ── Core types ────────────────────────────────────────────────────────────────

export interface MissionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  output_url?: string;
  summary?: string;
}

export interface Mission {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  command: string;
  params: Record<string, unknown>;
  status: MissionStatus;
  priority: MissionPriority;
  mcu_cost: number;
  mcu_reserved: number;
  result: MissionResult | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Request / Response shapes ─────────────────────────────────────────────────

export interface CreateMissionRequest {
  /** PEV command to execute, e.g. "sales:battlecard" */
  command: MissionCommand;
  /** Human-readable title — defaults to command if omitted */
  title?: string;
  description?: string;
  params?: Record<string, unknown>;
  priority?: MissionPriority;
  /** Public HTTPS URL to receive webhook on completion */
  webhook_url?: string;
}

export interface CreateMissionResponse {
  mission_id: string;
  status: MissionStatus;
  mcu_cost: number;
}

export interface ListMissionsResponse {
  missions: Mission[];
}

export interface MissionResultResponse {
  mission_id: string;
  command: string;
  status: MissionStatus;
  result: MissionResult | null;
  error_message: string | null;
  mcu_cost: number;
  completed_at: string | null;
}

/** Returned when mission is still in progress (HTTP 202) */
export interface MissionPendingResponse {
  mission_id: string;
  status: MissionStatus;
  message: string;
}

export interface CancelMissionResponse {
  cancelled: boolean;
  mission_id: string;
  mcu_refunded: number;
}

// ── SDK config ────────────────────────────────────────────────────────────────

export interface SophiaClientConfig {
  apiKey: string;
  /** Defaults to "https://sophia-ai-factory.vercel.app" */
  baseUrl?: string;
}

export interface WaitForResultOptions {
  /** Poll interval in ms. Default: 2000 */
  pollIntervalMs?: number;
  /** Total wait timeout in ms. Default: 300_000 (5 min) */
  timeoutMs?: number;
}
