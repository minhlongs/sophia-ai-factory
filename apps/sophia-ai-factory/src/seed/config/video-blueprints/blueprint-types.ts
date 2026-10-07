/**
 * Video Blueprints Types & Contracts
 *
 * Layer: seed (foundational primitives & schemas)
 * @module seed/config/video-blueprints/blueprint-types
 */

import { z } from 'zod';

export type VideoNiche = 'saas_global' | 'crypto_global';

export type VideoAspectRatio = '9:16' | '16:9' | '1:1';

export type HookArchetype =
  | 'STATISTIC_PAIN'
  | 'POLARIZING_VERDICT'
  | 'HIGH_CURIOSITY_LIST'
  | 'FINANCIAL_LOSS_WARNING'
  | 'AUTOMATION_PROOF'
  | 'EXCLUSIVE_ACCESS';

export interface StoryboardSceneSpec {
  sceneIndex: number;
  name: string;
  startSec: number;
  endSec: number;
  pacingDesc: string;
  visualPrompt: string;
  sfxCue?: string;
  cameraMotion?: string;
  overlayText?: string;
}

export interface VideoBlueprint {
  id: string;
  niche: VideoNiche;
  name: string;
  description: string;
  targetAudience: string;
  hookArchetype: HookArchetype;
  defaultDurationSec: number;
  aspectRatio: VideoAspectRatio;
  scenes: StoryboardSceneSpec[];
  complianceRequirements: {
    requiresFtcDisclosure: boolean;
    requiresCryptoRiskBanner: boolean;
    requiresEndCard15s: boolean;
    restrictedJurisdictions?: string[];
  };
  monetizationModel: 'RECURRING_MRR' | 'VOLUME_REBATE' | 'DUAL_AFFILIATE';
}

export const StoryboardSceneSpecSchema = z.object({
  sceneIndex: z.number().int().min(0),
  name: z.string().min(1),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  pacingDesc: z.string().min(1),
  visualPrompt: z.string().min(1),
  sfxCue: z.string().optional(),
  cameraMotion: z.string().optional(),
  overlayText: z.string().optional(),
});

export const VideoBlueprintSchema = z.object({
  id: z.string().min(1),
  niche: z.enum(['saas_global', 'crypto_global']),
  name: z.string().min(1),
  description: z.string().min(1),
  targetAudience: z.string().min(1),
  hookArchetype: z.enum([
    'STATISTIC_PAIN',
    'POLARIZING_VERDICT',
    'HIGH_CURIOSITY_LIST',
    'FINANCIAL_LOSS_WARNING',
    'AUTOMATION_PROOF',
    'EXCLUSIVE_ACCESS',
  ]),
  defaultDurationSec: z.number().int().min(15).max(600),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']),
  scenes: z.array(StoryboardSceneSpecSchema).min(1),
  complianceRequirements: z.object({
    requiresFtcDisclosure: z.boolean(),
    requiresCryptoRiskBanner: z.boolean(),
    requiresEndCard15s: z.boolean(),
    restrictedJurisdictions: z.array(z.string()).optional(),
  }),
  monetizationModel: z.enum(['RECURRING_MRR', 'VOLUME_REBATE', 'DUAL_AFFILIATE']),
});
