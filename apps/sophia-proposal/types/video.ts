/**
 * Video AI Types
 *
 * Types for HeyGen video generation integration
 */

/**
 * Video asset database row
 */
export interface VideoAsset {
  id: string;
  org_id: string;
  proposal_id: string;
  heygen_video_id: string;
  video_type: "intro" | "section" | "full_proposal" | "custom";
  template_id?: string;
  status: "pending" | "processing" | "ready" | "failed";
  video_url?: string;
  preview_url?: string;
  script_text: string;
  avatar_id?: string;
  voice_id?: string;
  background_id?: string;
  duration_seconds?: number;
  mcu_cost: number;
  error_message?: string;
  heygen_response?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  ready_at?: string;
}

/**
 * Video asset insert
 */
export interface VideoAssetInsert {
  org_id: string;
  proposal_id: string;
  heygen_video_id: string;
  video_type: "intro" | "section" | "full_proposal" | "custom";
  template_id?: string;
  status?: "pending" | "processing" | "ready" | "failed";
  video_url?: string;
  preview_url?: string;
  script_text: string;
  avatar_id?: string;
  voice_id?: string;
  background_id?: string;
  duration_seconds?: number;
  mcu_cost: number;
  error_message?: string;
  heygen_response?: Record<string, unknown>;
}

/**
 * Video asset update
 */
export interface VideoAssetUpdate {
  heygen_video_id?: string;
  video_type?: "intro" | "section" | "full_proposal" | "custom";
  template_id?: string;
  status?: "pending" | "processing" | "ready" | "failed";
  video_url?: string;
  preview_url?: string;
  avatar_id?: string;
  voice_id?: string;
  background_id?: string;
  duration_seconds?: number;
  error_message?: string;
  heygen_response?: Record<string, unknown>;
  ready_at?: string;
}

/**
 * Video template database row
 */
export interface VideoTemplate {
  id: string;
  org_id?: string; // null = global template
  name: string;
  description?: string;
  template_type: "intro" | "section" | "full_proposal" | "custom";
  heygen_template_id?: string;
  avatar_id?: string;
  voice_id?: string;
  background_id?: string;
  default_script?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Video template insert
 */
export interface VideoTemplateInsert {
  org_id?: string;
  name: string;
  description?: string;
  template_type: "intro" | "section" | "full_proposal" | "custom";
  heygen_template_id?: string;
  avatar_id?: string;
  voice_id?: string;
  background_id?: string;
  default_script?: string;
  is_active?: boolean;
}

/**
 * Video generation status
 */
export type VideoStatus = "pending" | "processing" | "ready" | "failed";

/**
 * Video types for proposal generation
 */
export type VideoType = "intro" | "section" | "full_proposal" | "custom";

/**
 * HeyGen API response types
 */
export interface HeyGenTaskResponse {
  code: number;
  message: string;
  data?: {
    video_id: string;
    status: "queued" | "processing" | "completed" | "failed";
    video_url?: string;
    preview_url?: string;
    duration?: number;
    created_at?: string;
    error_message?: string;
  };
}

/**
 * Video generation request
 */
export interface VideoGenerationRequest {
  proposalId: string;
  videoType: VideoType;
  templateId?: string;
  scriptText: string;
  avatarId?: string;
  voiceId?: string;
  backgroundId?: string;
}

/**
 * Video generation response
 */
export interface VideoGenerationResponse {
  success: boolean;
  videoId?: string;
  status: VideoStatus;
  estimatedTime?: number; // seconds
  error?: string;
}

/**
 * HeyGen avatar
 */
export interface HeyGenAvatar {
  id: string;
  name: string;
  preview_url: string;
  style: "formal" | "casual" | "business";
}

/**
 * HeyGen voice
 */
export interface HeyGenVoice {
  id: string;
  name: string;
  language: string;
  gender: "male" | "female";
  preview_url?: string;
}

/**
 * Webhook payload from HeyGen
 */
export interface HeyGenWebhookPayload {
  event: "task.completed" | "task.failed";
  task_id: string;
  video_id: string;
  video_url?: string;
  error_message?: string;
  timestamp: string;
}
