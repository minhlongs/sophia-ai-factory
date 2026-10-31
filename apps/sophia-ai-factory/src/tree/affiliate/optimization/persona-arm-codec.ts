/**
 * Persona Arm Codec — composite bandit key encoding for Video Gender 2027.
 *
 * The bandit optimizes over the full creative triple rather than a single
 * hook angle: which hook angle, which presenter gender, and which localized
 * voice dialect. Each distinct triple is one arm, identified by a stable
 * string key so that feedback rows recorded across sessions collapse onto the
 * same arm without a lookup table.
 *
 * Layer: tree/affiliate/optimization (domain-reusable)
 * @module tree/affiliate/optimization/persona-arm-codec
 */

import type { Gender } from '@/seed/voices/preset-catalog/types';
import type { RegionalDialect } from '@/seed/types/cultural-adaptation-dialect-subtitle';

/** Persona genders the bandit is allowed to explore. */
export const PERSONA_ARM_GENDERS = ['male', 'female'] as const;

export type PersonaArmGender = (typeof PERSONA_ARM_GENDERS)[number];

/** Dialects the bandit is allowed to explore. */
export const PERSONA_ARM_DIALECTS = ['vi-TN-bac', 'vi-TN-nam', 'vi-TN-trung', 'en-US'] as const;

export type PersonaArmDialect = (typeof PERSONA_ARM_DIALECTS)[number];

/** One creative triple the bandit can pull. */
export interface PersonaArmSpec {
  /** Hook angle label (e.g. 'pain_point', 'authority', 'curiosity'). */
  hookAngle: string;
  /** Presenter persona gender. */
  personaGender: PersonaArmGender;
  /** Localized voice dialect tag. */
  voiceDialect: PersonaArmDialect | string;
}

function normalizeSegment(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Encodes a creative triple into a stable composite arm key.
 * Order is fixed (hookAngle|gender|dialect) so decoding is a simple split.
 */
export function encodePersonaArmKey(spec: PersonaArmSpec): string {
  const gender = normalizeSegment(spec.personaGender);
  if (gender !== 'male' && gender !== 'female') {
    throw new Error(`Unsupported persona gender for bandit arm: ${String(spec.personaGender)}`);
  }
  return [normalizeSegment(spec.hookAngle), gender, normalizeSegment(spec.voiceDialect)].join('|');
}

/**
 * Decodes a composite arm key back into its creative triple.
 * Returns null for a key that does not carry exactly three segments.
 */
export function decodePersonaArmKey(
  armKey: string,
): { hookAngle: string; personaGender: PersonaArmGender; voiceDialect: string } | null {
  const parts = armKey.split('|');
  if (parts.length !== 3) return null;
  const [hookAngle, gender, voiceDialect] = parts;
  if (gender !== 'male' && gender !== 'female') return null;
  return { hookAngle, personaGender: gender, voiceDialect };
}

/** Accepts a bandit-eligible gender, falling back to the B2B default. */
export function toPersonaArmGender(gender: Gender | string | undefined): PersonaArmGender {
  return normalizeSegment(String(gender ?? 'female')) === 'male' ? 'male' : 'female';
}

/** Normalizes a regional dialect tag into a bandit-usable arm dialect. */
export function toPersonaArmDialect(
  dialect: RegionalDialect | string | undefined,
): PersonaArmDialect {
  const tag = normalizeSegment(String(dialect ?? 'en-us')).replace(/_/g, '-');
  if (tag.startsWith('en')) return 'en-US';
  if (tag.includes('nam')) return 'vi-TN-nam';
  if (tag.includes('trung')) return 'vi-TN-trung';
  return 'vi-TN-bac';
}

/** Builds a bandit-eligible arm spec from a niche, dialect, and persona gender. */
export function buildPersonaArmSpec(input: {
  hookAngle: string;
  dialect?: RegionalDialect | string;
  genders?: Partial<Record<'male' | 'female' | 'other', number>>;
  mabPreferredGender?: Gender;
}): PersonaArmSpec {
  return {
    hookAngle: input.hookAngle,
    personaGender: toPersonaArmGender(input.mabPreferredGender ?? personaGenderFromDemographics(input.genders)),
    voiceDialect: toPersonaArmDialect(input.dialect),
  };
}

/** Picks the dominant bandit-eligible gender from a demographic distribution. */
function personaGenderFromDemographics(
  genders?: Partial<Record<'male' | 'female' | 'other', number>>,
): PersonaArmGender {
  const male = genders?.male ?? 0;
  const female = genders?.female ?? 0;
  return male > female ? 'male' : 'female';
}
