'use client';

/**
 * Multi-Channel Distribution Pack & 7-Day Schedule Helpers for Customer Pilot.
 *
 * Generates ready-to-paste copy tailored to YouTube SEO (with auto 00:00 chapters),
 * TikTok, Facebook/Instagram Reels, and Zalo/Telegram/Community at $0 extra AI cost.
 *
 * @module components/first-value/pilot-distribution-hub-helpers
 */

import type { ScriptOutput } from '@/seed/ai/script-generator';

export type DistributionChannelId = 'youtube' | 'tiktok' | 'reels' | 'community' | 'aeo_geo';

export interface DistributionChannelPack {
  readonly id: DistributionChannelId;
  readonly studioUrl: string;
  readonly copyText: string;
}

export interface SevenDayCadenceItem {
  readonly day: number;
  readonly asset: string;
  readonly channels: string;
  readonly goal: string;
}

export interface MultiChannelDistributionPack {
  readonly channels: readonly DistributionChannelPack[];
  readonly schedule: readonly SevenDayCadenceItem[];
}

function formatChapterTimestamp(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function buildYouTubeChapters(script: ScriptOutput): string {
  let cursor = 0;
  return script.scenes
    .map((scene) => {
      const stamp = formatChapterTimestamp(cursor);
      const label = scene.title?.trim() || `Part ${scene.scene_number}`;
      cursor += Math.max(2, Math.round(scene.duration_estimate || 6));
      return `${stamp} ${label}`;
    })
    .join('\n');
}

export function buildAeoGeoJsonLd(args: {
  readonly script: ScriptOutput;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
}): string {
  const hook = args.script.scenes[0]?.narration.trim() || args.script.title;
  const proof =
    args.script.scenes[1]?.narration.trim() ||
    args.script.scenes[0]?.narration.trim() ||
    args.script.title;
  const verdict =
    args.script.scenes[args.script.scenes.length - 1]?.narration.trim() || args.ctaText;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoObject',
        name: args.script.title,
        description: `${hook} ${args.ctaText} (${args.disclosureTag})`,
        duration: `PT${Math.max(15, Math.round(args.script.total_duration || 30))}S`,
        url: args.shortUrl,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `${args.script.title} — Is it worth using?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${hook} ${verdict}`,
            },
          },
          {
            '@type': 'Question',
            name: `What is the key proof or workflow highlight?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: proof,
            },
          },
          {
            '@type': 'Question',
            name: `Where is the official verified link?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${args.ctaText}: ${args.shortUrl} (${args.disclosureTag})`,
            },
          },
        ],
      },
    ],
  };

  return JSON.stringify(graph, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function buildMultiChannelDistributionPack(args: {
  readonly script: ScriptOutput;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
}): MultiChannelDistributionPack {
  const hook = args.script.scenes[0]?.narration.trim() || args.script.title;
  const chapters = buildYouTubeChapters(args.script);

  const youtubeCopy = [
    `[TITLE]`,
    `${args.script.title}`,
    ``,
    `[DESCRIPTION]`,
    `${hook}`,
    ``,
    `👉 ${args.ctaText}: ${args.shortUrl}`,
    ``,
    `⏱️ Chapters:`,
    chapters,
    ``,
    `${args.disclosureTag} #review #affiliate`,
    ``,
    `[PINNED COMMENT]`,
    `👉 ${args.ctaText}: ${args.shortUrl} (${args.disclosureTag})`,
  ].join('\n');

  const tiktokCopy = [
    `${hook}`,
    `👉 ${args.ctaText} (Link ở Bio / Bình luận ghim)`,
    `${args.disclosureTag} #saas #crypto #review #affiliate`,
    ``,
    `[PINNED COMMENT]`,
    `${args.ctaText}: ${args.shortUrl} (${args.disclosureTag})`,
  ].join('\n');

  const reelsCopy = [
    `${args.script.title}`,
    `${hook}`,
    ``,
    `👉 ${args.ctaText}: ${args.shortUrl}`,
    `${args.disclosureTag} #reels #review #affiliate`,
  ].join('\n');

  const communityCopy = [
    `🔥 ${args.script.title}`,
    `${hook}`,
    ``,
    `✅ Xem chi tiết & nhận ưu đãi tại đây: ${args.shortUrl}`,
    `${args.disclosureTag}`,
  ].join('\n');

  const aeoJsonLd = buildAeoGeoJsonLd(args);
  const proofLine =
    args.script.scenes[1]?.narration.trim() ||
    args.script.scenes[0]?.narration.trim() ||
    args.script.title;
  const aeoGeoCopy = [
    `[DIRECT ANSWER — AEO / GEO Citation Block]`,
    `${args.script.title}: ${hook} ${proofLine}`,
    `Official Partner Link (${args.disclosureTag}): ${args.shortUrl}`,
    ``,
    `[STRUCTURED FAQ FOR AI SEARCH (ChatGPT / Perplexity / Gemini)]`,
    `Q1: ${args.script.title} — Có đáng dùng không?`,
    `A1: ${hook}`,
    `Q2: Điểm nổi bật thực tế nhất là gì?`,
    `A2: ${proofLine}`,
    `Q3: Link đăng ký chính thức ở đâu?`,
    `A3: ${args.ctaText} — ${args.shortUrl} (${args.disclosureTag})`,
    ``,
    `[JSON-LD SCHEMA (Blog / WordPress / Webflow)]`,
    `<script type="application/ld+json">`,
    aeoJsonLd,
    `</script>`,
  ].join('\n');

  const channels: readonly DistributionChannelPack[] = [
    {
      id: 'youtube',
      studioUrl: 'https://studio.youtube.com/',
      copyText: youtubeCopy,
    },
    {
      id: 'tiktok',
      studioUrl: 'https://www.tiktok.com/tiktokstudio/upload',
      copyText: tiktokCopy,
    },
    {
      id: 'reels',
      studioUrl: 'https://business.facebook.com/latest/reels_composer',
      copyText: reelsCopy,
    },
    {
      id: 'community',
      studioUrl: 'https://chat.zalo.me/',
      copyText: communityCopy,
    },
    {
      id: 'aeo_geo',
      studioUrl: 'https://medium.com/new-story',
      copyText: aeoGeoCopy,
    },
  ];

  const schedule: readonly SevenDayCadenceItem[] = [
    {
      day: 1,
      asset: 'YouTube 16:9 + Short #1 (Hook)',
      channels: 'YouTube + TikTok + Reels',
      goal: 'Launch main review & initial reach',
    },
    {
      day: 3,
      asset: 'Short #2 (Core Value & Proof)',
      channels: 'TikTok + YouTube Shorts + FB Reels',
      goal: 'Drive proof-based clicks to /api/r/[code]',
    },
    {
      day: 5,
      asset: 'Short #3 (Verdict & Offer)',
      channels: 'TikTok + IG Reels + Shorts',
      goal: 'Convert high-intent viewers',
    },
    {
      day: 7,
      asset: 'Community / Zalo / Telegram Recap',
      channels: 'Zalo + Telegram + FB Group',
      goal: 'Capture warm audience & reconcile clicks',
    },
  ];

  return { channels, schedule };
}
