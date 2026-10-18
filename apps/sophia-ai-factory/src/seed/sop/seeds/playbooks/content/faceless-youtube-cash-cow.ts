/**
 * Seed: Faceless YouTube Cash Cow
 * Build a fully-automated faceless YouTube channel in profitable niches.
 * Category: content | Featured: yes
 */

import type { SopSeedEntry } from '../../index';
import { FACELESS_YOUTUBE_PLAYBOOK_MD } from './faceless-youtube-cash-cow-content';

export const slug = 'faceless-youtube-cash-cow';

export const template: SopSeedEntry = {
  slug,
  nameVi: 'Kênh YouTube Faceless Kiếm Tiền',
  nameEn: 'Faceless YouTube Cash Cow',
  descVi:
    'Xây dựng kênh YouTube faceless hoàn toàn tự động trong ngách có lợi nhuận cao: tài chính, động lực, công nghệ — từ kịch bản đến thumbnail đến đăng tải',
  descEn:
    'Build a fully-automated faceless YouTube channel in high-profit niches (finance, motivation, tech) — from niche research to script, voiceover, video, thumbnail, and publish',
  category: 'content',
  creditsPerRun: 15,
  setupTimeMinutes: 30,
  isFeatured: 1,
  agentsYaml: `agents:
  niche_researcher:
    role: Niche Researcher
    goal: Research profitable YouTube niches and trending topics for {{config.niche}}
    tools:
      - analytics:report
    backstory: YouTube monetization strategist specialising in faceless cash-cow channels

  script_writer:
    role: Script Writer
    goal: Write SEO-optimized video script with strong hook, value delivery, and CTA
    tools:
      - ai:generate
    backstory: Long-form YouTube scriptwriter with expertise in retention and monetization copy

  video_producer:
    role: Video Producer
    goal: Produce full AI video with voiceover, visuals, and thumbnail
    tools:
      - tts:generate
      - video:create
      - video:compose
      - image:generate
    backstory: AI video production specialist for faceless channel automation`,
  playbookMd: FACELESS_YOUTUBE_PLAYBOOK_MD,
  outputSchema: JSON.stringify({
    type: 'object',
    required: ['video_url', 'thumbnail_url', 'youtube_url'],
    properties: {
      video_url: { type: 'string' },
      thumbnail_url: { type: 'string' },
      youtube_url: { type: 'string' },
    },
  }),
  configSchema: JSON.stringify({
    properties: {
      niche: {
        type: 'string',
        title: 'Niche',
        enum: ['finance', 'motivation', 'tech', 'health', 'gaming'],
        default: 'finance',
      },
      language: {
        type: 'string',
        title: 'Language',
        enum: ['en', 'vi'],
        default: 'en',
      },
      duration_seconds: {
        type: 'number',
        title: 'Video Duration (sec)',
        default: 480,
        minimum: 120,
        maximum: 1200,
      },
    },
    required: ['niche'],
  }),
  configDefaults: JSON.stringify({
    niche: 'finance',
    language: 'en',
    duration_seconds: 480,
  }),
};
