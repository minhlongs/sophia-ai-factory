/**
 * Viral Funnel Badges Component Helpers
 *
 * Layer: Forest (UI components & coordinators)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/viral-funnel/funnel-badges
 */

import React from 'react';
import type { ViralNiche, ViralPlatform } from '@/seed/types/growth';

export function getNicheBadge(niche: ViralNiche, isVi: boolean): React.ReactElement {
  switch (niche) {
    case 'ai_automation':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {isVi ? 'Tự Động Hóa AI' : 'AI Automation'}
        </span>
      );
    case 'ecommerce':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {isVi ? 'Thương Mại Điện Tử' : 'E-commerce'}
        </span>
      );
    case 'solopreneur':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
          {isVi ? 'Kinh Doanh Độc Lập' : 'Solopreneur'}
        </span>
      );
  }
}

export function getPlatformBadge(platform: ViralPlatform | 'all'): React.ReactElement {
  switch (platform) {
    case 'tiktok':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
          TikTok
        </span>
      );
    case 'youtube_shorts':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          YT Shorts
        </span>
      );
    case 'twitter':
    case 'x':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
          X (Twitter)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-300">
          Multi
        </span>
      );
  }
}
