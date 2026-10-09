/**
 * @file types.ts
 * @description Type definitions for viral hook and script prompts engine.
 * @layer tree
 */

import type { ViralNiche, HookArchetype, ViralScriptSection } from '@/seed/types/growth';

export interface NicheProfile {
  id: ViralNiche;
  name: string;
  nameVi: string;
  targetAudience: string;
  targetAudienceVi: string;
  primaryPains: string[];
  primaryPainsVi: string[];
  desires: string[];
  desiresVi: string[];
  recommendedKeywords: string[];
}

export interface ArchetypeDefinition {
  archetype: HookArchetype;
  name: string;
  nameVi: string;
  psychologicalMechanism: string;
  idealDurationSec: number;
  deliveryStyle: string;
}

export interface ScriptTemplateData {
  hookId: string;
  niche: ViralNiche;
  title: string;
  titleVi: string;
  sections: ViralScriptSection[];
  ctaText: string;
  ctaTextVi: string;
}
