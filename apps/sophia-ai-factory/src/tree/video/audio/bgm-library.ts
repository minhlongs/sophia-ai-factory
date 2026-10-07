/**
 * Curated royalty-free background music library for SaaS & Crypto videos.
 */

import type { BGMEnergyLevel, BGMTrack } from './audio-types';

export const CURATED_BGM_TRACKS: readonly BGMTrack[] = [
  {
    id: 'bgm-cyber-pulse-140',
    name: 'Cybernetic Neon Pulse',
    energyLevel: 'dark_cyberpunk',
    url: 'https://assets.agencyos.network/audio/bgm/cyber-pulse-140bpm.mp3',
    durationSeconds: 60.0,
    bpm: 140,
    tags: ['synthwave', 'crypto', 'dark', 'futuristic', 'trading'],
    recommendedNiches: ['crypto_global'],
  },
  {
    id: 'bgm-saas-sleek-lofi-120',
    name: 'Silicon Flow Tech Minimal',
    energyLevel: 'corporate_sleek',
    url: 'https://assets.agencyos.network/audio/bgm/silicon-flow-120bpm.mp3',
    durationSeconds: 60.0,
    bpm: 120,
    tags: ['clean', 'saas', 'modern', 'corporate', 'clarity'],
    recommendedNiches: ['saas_global'],
  },
  {
    id: 'bgm-hype-drill-trap-145',
    name: 'Viral Dopamine Trap Riser',
    energyLevel: 'high_energy_hype',
    url: 'https://assets.agencyos.network/audio/bgm/dopamine-trap-145bpm.mp3',
    durationSeconds: 45.0,
    bpm: 145,
    tags: ['hype', 'viral', 'fast', 'tiktok', 'shorts', 'breakout'],
    recommendedNiches: ['crypto_global', 'saas_global'],
  },
];

export function getBgmForNiche(
  niche: 'saas_global' | 'crypto_global',
  preferredEnergy?: BGMEnergyLevel
): BGMTrack {
  if (preferredEnergy) {
    const match = CURATED_BGM_TRACKS.find((t) => t.energyLevel === preferredEnergy);
    if (match) return match;
  }
  const defaultNicheTrack = CURATED_BGM_TRACKS.find((t) =>
    t.recommendedNiches.includes(niche)
  );
  return defaultNicheTrack || CURATED_BGM_TRACKS[0];
}
