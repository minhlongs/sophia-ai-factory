/**
 * Sophia Client SDK Types and Models
 *
 * Layer: sdk
 */

export interface SophiaClientOptions {
  /** Your Sophia API key (from /dashboard/api-keys) or bearer token */
  apiKey?: string;
  token?: string;
  /** Override API base URL. Defaults to https://sophia.agencyos.network */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

export type SophiaToken = string;

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class SophiaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'SophiaApiError';
  }
}

// ─── Missions Types ─────────────────────────────────────────────────────────

export interface Mission {
  id: string;
  command: string;
  params: Record<string, unknown> | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  result: Record<string, unknown> | null;
  error: string | null;
  credits_used: number;
  credits_required?: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  webhook_url: string | null;
  webhook_fired_at: number | null;
  eta_seconds?: number;
  stream_url?: string;
}

export interface CreateMissionOptions {
  command: string;
  params?: Record<string, unknown>;
  webhook_url?: string;
}

export interface ListMissionsOptions {
  status?: string;
  command?: string;
  limit?: number;
  cursor?: string;
}

export interface PaginatedMissions {
  missions: Mission[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface MissionEvent {
  event: string;
  data: Record<string, unknown>;
}

// ─── Credits Types ──────────────────────────────────────────────────────────

export interface McuBalance {
  credits_remaining: number;
  credits_total_purchased: number;
  credits_total_used: number;
  recent_transactions?: unknown[];
}

export interface ConsumeCreditsOptions {
  amount: number;
  reason?: string;
  missionId?: string;
}

export interface ConsumeCreditsResult {
  success: boolean;
  credits_remaining: number;
  credits_consumed: number;
  transaction_id?: string;
}

// ─── Algorithms & Publishing Types ──────────────────────────────────────────

export type {
  AffiliateDescriptionOptions,
  AffiliateDescription,
  TranslateInput,
  TranslateResult,
  VoiceCloneInput,
  VoiceCloneResult,
  SeoScriptInput,
  SeoScriptResult,
  LiveStats,
  PublishScheduleInput,
  PublishScheduleResult,
  PublishProvider,
  RegisterChannelInput,
  RegisterChannelResult,
} from './sdk-algorithm-types';
