/**
 * @file thumbnail-spec.ts
 * @description CTR-maximizing thumbnail prompt and layout specification generator.
 * @layer tree
 */

import type { ApacLanguage, PlatformType, ThumbnailPromptSpec } from '@/seed/types/apac-syndication';

export function generateThumbnailPromptSpec(params: {
  topic: string;
  language: ApacLanguage;
  platform: PlatformType;
  hookHeadline: string;
}): ThumbnailPromptSpec {
  const { topic, hookHeadline } = params;

  // Short 3-5 word headline for visual thumbnail badge
  const words = hookHeadline.split(/\s+/);
  const headlineBadge = words.length > 5 ? words.slice(0, 5).join(' ') + '...' : hookHeadline;

  const colorPalette = [
    '#00F0FF (Electric Cyan)',
    '#FF0055 (Neon Magenta)',
    '#FFE600 (High-Contrast Cyber Amber)',
    '#0D0E15 (Deep Pitch Midnight)',
  ];

  const prompt = [
    `Hyper-detailed YouTube Shorts/TikTok 9:16 mobile thumbnail background for viral video about "${topic}".`,
    `Focal Point: Dynamic ultra-realistic human specialist with intense shocked expression, pointing towards glowing holographic AI interface displaying explosive growth metrics.`,
    `Typography & Layout: High-contrast upper third header area reserved for bold 3D sans-serif Vietnamese/English headline text: "${headlineBadge}".`,
    `Color & Lighting: Neon cyan and vivid magenta rim lighting, cinematic dramatic volumetric backlight, crisp sharp details, 8k resolution, photorealistic Unreal Engine 5 render, mobile-first CTR design.`,
    `No cluttered small text, high readability at 120px scale on mobile screen.`,
  ].join(' ');

  return {
    aspectRatio: '9:16',
    layout: 'Mobile-first vertical 9:16, bold upper-third typography, high-contrast focal subject with rim glow',
    headlineText: headlineBadge,
    colorPalette,
    visualFocus: `Shocked expert subject + glowing futuristic holographic dashboard representing ${topic}`,
    lighting: 'Dramatic cinematic rim lighting (electric cyan & neon magenta) with deep dark contrast',
    prompt,
  };
}
