/**
 * @file identity.ts
 * @description Identity entities for creators, workspaces, brands, and creative identity.
 * @layer seed
 */

import type { AutonomyLevel } from './autonomy';

export interface Creator {
  id: string;
  userId: string; // links to auth user
  displayName: string;
  bio?: string;
  timezone: string;
  locale: 'vi' | 'en';
  onboardingComplete: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  id: string;
  creatorId: string;
  name: string;
  description?: string;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  autonomyLevel: AutonomyLevel;
  monthlyBudgetCents: number;
  currency: string;
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Brand {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  fontPrimary?: string;
  logoAssetId?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export type Tone = 'formal' | 'casual' | 'sharp' | 'warm' | 'playful' | 'authoritative' | 'empathetic';

export interface ContentFormat {
  type: 'video_short' | 'video_long' | 'image' | 'audio' | 'article' | 'carousel';
  platform: 'youtube' | 'tiktok' | 'x' | 'instagram' | 'facebook' | 'whatsapp' | 'blog';
  maxDurationSeconds?: number;
  aspectRatio?: string;
  constraints: string[];
}

export interface CreativeIdentity {
  id: string;
  workspaceId: string;
  brandId?: string;

  // Voice
  voiceDescription: string;
  tone: Tone;
  formality: number; // 0-1 scale
  energy: number; // 0-1 scale

  // Positioning
  beliefs: string[];
  positioning: string;
  targetAudience: string;

  // Constraints
  forbiddenPatterns: string[];
  requiredDisclosures: string[];

  // Preferences
  preferredFormats: ContentFormat[];
  referenceWorks: string[]; // IDs or URLs of approved examples

  // Metadata
  version: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy: string; // userId
}
