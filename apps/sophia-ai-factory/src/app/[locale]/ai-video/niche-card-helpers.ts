/**
 * Niche card mapping and emoji lookup helpers for AI Video Hub Page.
 */

import { NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';

export interface NicheCardItem {
  name: string;
  emoji: string;
  slug: string;
}

const NICHE_EMOJI_MAP: Record<string, string> = {
  'real-estate': '\u{1F3E0}',
  'e-commerce': '\u{1F6D2}',
  crypto: '\u{1F4B0}',
  health: '\u{1F3E5}',
  education: '\u{1F393}',
  restaurant: '\u{1F37D}️',
  fitness: '\u{1F4AA}',
  lawyer: '\u{2696}️',
  insurance: '\u{1F6E1}️',
  travel: '\u{2708}️',
  automotive: '\u{1F697}',
  fashion: '\u{1F454}',
  gaming: '\u{1F3AE}',
  music: '\u{1F3B5}',
  photography: '\u{1F4F8}',
  beauty: '\u{1F484}',
  sports: '\u{26BD}',
  pets: '\u{1F436}',
  'home-services': '\u{1F3E1}',
  dental: '\u{1F9B7}',
  wedding: '\u{1F48D}',
  saas: '\u{1F4BB}',
  nonprofit: '\u{1F91D}',
  construction: '\u{1F3D7}️',
  logistics: '\u{1F69A}',
};

/** Map niche slugs to representative emoji for visual distinction. */
export function nicheEmoji(slug: string): string {
  return NICHE_EMOJI_MAP[slug] ?? '\u{1F3AC}';
}

export function getNicheCard(niche: string, isVi: boolean): NicheCardItem {
  const label = NICHE_LABELS[niche as NicheSlug];
  const name = label ? (isVi ? label.vi : label.en) : niche.replace(/-/g, ' ');
  const emoji = nicheEmoji(niche);

  return { name, emoji, slug: niche };
}
