/**
 * Video Domain Types
 *
 * Database row types for video campaigns, usage tracking.
 * Extracted from supabase-types.ts for modular organization.
 *
 * @module seed/types/video
 */

import { Json } from './json';

// Campaign (video generation campaigns)
export interface CampaignRow {
  id: string;
  user_id: string;
  title: string;
  topic?: string | null;
  audience?: string | null;
  status: 'draft' | 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed';
  progress: number | null;
  error_message?: string | null;
  script_content?: Json | null;
  audio_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  template_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignTemplateRow {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  defaults: Json;
  is_predefined: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignTemplateInsert {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  defaults: Json;
  is_predefined?: boolean;
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CampaignTemplateUpdate {
  name?: string;
  description?: string;
  category?: string;
  icon?: string;
  defaults?: Json;
  is_predefined?: boolean;
  updated_at?: string;
}

// Usage events (for metering)
export interface UsageEventRow {
  id?: string;
  user_id: string;
  license_key_hash: string;
  license_nonce: string;
  service_name: string;
  endpoint: string;
  action: string;
  tokens_input: number;
  tokens_output: number;
  credits_used: number;
  request_id: string | null;
  model_name: string | null;
  tier_at_request: string;
  status_code: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: number;
  idempotency_key: string | null;
  external_customer_id: string | null;
  resource_type: string | null;
}

export interface UsageEventInsert {
  user_id: string;
  license_key_hash: string;
  license_nonce: string;
  service_name: string;
  endpoint: string;
  action: string;
  tokens_input?: number;
  tokens_output?: number;
  credits_used: number;
  request_id?: string | null;
  model_name?: string | null;
  tier_at_request: string;
  status_code?: number | null;
  error_message?: string | null;
  response_time_ms?: number | null;
  created_at?: number;
  idempotency_key?: string | null;
  external_customer_id?: string | null;
  resource_type?: string | null;
}
