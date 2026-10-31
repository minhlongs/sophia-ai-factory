/**
 * Video Persona & Localized Voice Resolver
 *
 * Connects audience demographics (or MAB feedback) with localized voice profiles
 * and avatar archetypes. Pure and deterministic.
 *
 * Layer: tree (domain-reusable)
 * @module tree/audience/persona-gender-resolver
 */

import type { Gender } from '@/seed/voices/preset-catalog/types';
import type { RegionalDialect } from '@/seed/types/cultural-adaptation-dialect-subtitle';
import { resolveDialectVoice } from '@/seed/voices/profiles/profile-resolver';
import type { LocalizedVoiceProfile } from '@/seed/voices/profiles/types';

export type VideoAvatarStyle =
  | 'executive_expert'
  | 'energetic_reviewer'
  | 'technical_analyst';

export interface ResolveVideoPersonaInput {
  niche: 'crypto_global' | 'saas_global' | 'ecommerce_vn' | string;
  dialect?: RegionalDialect;
  genders?: Partial<Record<'male' | 'female' | 'other', number>>;
  mabPreferredGender?: Gender;
}

export interface ResolvedVideoPersona {
  gender: Gender;
  voiceProfile: LocalizedVoiceProfile;
  avatarStyle: VideoAvatarStyle;
  explanation: string;
}

/**
 * Resolves default dialect when none is explicitly specified.
 */
function resolveDefaultDialect(niche: string): RegionalDialect {
  if (niche === 'ecommerce_vn' || niche.endsWith('_vn')) {
    return 'vi-VN-bac';
  }
  return 'en-US';
}

/**
 * Derives avatar archetype according to niche characteristics.
 */
function resolveAvatarStyle(niche: string): VideoAvatarStyle {
  if (niche === 'crypto_global' || niche.includes('crypto')) {
    return 'technical_analyst';
  }
  if (niche === 'ecommerce_vn' || niche.includes('ecommerce')) {
    return 'energetic_reviewer';
  }
  return 'executive_expert';
}

/**
 * Resolves the optimal gender from demographics, MAB signal, or domain prior.
 */
function resolveGenderAndReason(
  niche: string,
  genders?: Partial<Record<'male' | 'female' | 'other', number>>,
  mabPreferredGender?: Gender,
): { gender: Gender; reason: string } {
  if (mabPreferredGender) {
    return {
      gender: mabPreferredGender,
      reason: `MAB optimization converged to ${mabPreferredGender} persona based on real EPC/CTR.`,
    };
  }

  if (genders) {
    const maleShare = genders.male ?? 0;
    const femaleShare = genders.female ?? 0;
    if (maleShare > femaleShare + 0.1) {
      return {
        gender: 'male',
        reason: `Demographics skew male (${(maleShare * 100).toFixed(0)}% vs ${(femaleShare * 100).toFixed(0)}%).`,
      };
    }
    if (femaleShare > maleShare + 0.1) {
      return {
        gender: 'female',
        reason: `Demographics skew female (${(femaleShare * 100).toFixed(0)}% vs ${(maleShare * 100).toFixed(0)}%).`,
      };
    }
  }

  if (niche === 'crypto_global' || niche.includes('crypto')) {
    return {
      gender: 'male',
      reason: 'Domain baseline for global crypto audiences defaults to male persona.',
    };
  }
  if (niche === 'ecommerce_vn' || niche.includes('ecommerce')) {
    return {
      gender: 'female',
      reason: 'Domain baseline for VN social commerce defaults to female reviewer persona.',
    };
  }

  return {
    gender: 'female',
    reason: 'Domain baseline for B2B SaaS onboarding defaults to friendly female persona.',
  };
}

/**
 * Pure resolver linking audience distribution to localized voice profile & avatar.
 */
export function resolveVideoPersona(input: ResolveVideoPersonaInput): ResolvedVideoPersona {
  const { niche, genders, mabPreferredGender } = input;
  const dialect = input.dialect ?? resolveDefaultDialect(niche);
  const { gender, reason } = resolveGenderAndReason(niche, genders, mabPreferredGender);

  const voiceGender: 'male' | 'female' = gender === 'male' ? 'male' : 'female';
  const voiceProfile = resolveDialectVoice(dialect, voiceGender);
  const avatarStyle = resolveAvatarStyle(niche);

  const explanation = `${reason} Selected ${gender} voice (${voiceProfile.displayName} / ${dialect}) and ${avatarStyle} archetype.`;

  return {
    gender,
    voiceProfile,
    avatarStyle,
    explanation,
  };
}
