import { Tier } from "@/seed/types";
import type { ScriptOutput } from "@/seed/ai/script-prompt-builders";
export type { ScriptOutput };

// --- Script Service Types ---

export interface AffiliateOfferCta {
  productName: string;
  shortUrl: string;
}

export interface GenerateScriptInput {
  topic: string;
  audience: string;
  tier: Tier;
  orgId?: string;
  userId?: string;
  affiliateOffer?: AffiliateOfferCta;
}

export interface ScriptScene {
  scene_number: number;
  visual_description: string;
  narration: string;
  duration_estimate: number;
}

export interface IScriptService {
  generateScript(input: GenerateScriptInput): Promise<ScriptOutput>;
}

// --- Voice Service Types ---

export interface GenerateVoiceoverInput {
  text: string;
  tier: Tier;
  voiceId?: string;
  userId?: string;
}

export interface VoiceoverOutput {
  audio_url: string;
  duration: number;
}

export interface IVoiceService {
  generateVoiceover(input: GenerateVoiceoverInput): Promise<VoiceoverOutput>;
}

// --- Video Service Types ---

export interface CreateVideoParams {
  avatarId: string;
  voiceId: string;
  script: string;
  title?: string;
}

export interface VideoStatus {
  id: string;
  status: "processing" | "completed" | "failed" | "pending";
  video_url?: string;
  thumbnail_url?: string;
  error?: string;
}

export interface Avatar {
  avatar_id: string;
  name: string;
  gender: string;
  preview_image_url: string;
}

export interface Voice {
  voice_id: string;
  name: string;
  gender: string;
  language: string;
  preview_audio?: string;
}

export interface IVideoService {
  createVideo(params: CreateVideoParams): Promise<string>;
  getVideoStatus(videoId: string): Promise<VideoStatus>;
  listAvatars(): Promise<Avatar[]>;
  listVoices(): Promise<Voice[]>;
}

// --- Payment Service Types ---

export interface CreateCheckoutParams {
  productIds: string[];
  successUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSession {
  url: string;
  id?: string;
}

export interface IPaymentService {
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession>;
}
