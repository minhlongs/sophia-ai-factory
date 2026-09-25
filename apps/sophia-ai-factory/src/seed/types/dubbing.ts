/**
 * APAC Video Dubbing & Multi-Language Subtitles Engine Contracts
 *
 * Layer: seed (pure types, schemas, and primitives)
 * Dependencies: zod
 *
 * @module seed/types/dubbing
 */

import { z } from 'zod';

// ─── Supported APAC Locales & Formats ──────────────────────────────────────────

export const APAC_LOCALES = ['vi', 'en', 'ja', 'ko', 'th'] as const;
export type ApacLocale = (typeof APAC_LOCALES)[number];

export const ApacLocaleSchema = z.enum(['vi', 'en', 'ja', 'ko', 'th']);

export const SubtitleFormatSchema = z.enum(['srt', 'vtt']);
export type SubtitleFormat = z.infer<typeof SubtitleFormatSchema>;

// ─── Transcript & Subtitle Models ──────────────────────────────────────────────

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export const TranscriptWordSchema = z.object({
  word: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
  confidence: z.number().min(0).max(1).optional(),
});

export interface SubtitleSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export const SubtitleSegmentSchema = z.object({
  id: z.number().int().positive(),
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
});

export interface SubtitleTrack {
  locale: ApacLocale;
  format: SubtitleFormat;
  content: string;
  r2Key?: string;
  url?: string;
}

export const SubtitleTrackSchema = z.object({
  locale: ApacLocaleSchema,
  format: SubtitleFormatSchema,
  content: z.string(),
  r2Key: z.string().optional(),
  url: z.string().url().optional(),
});

// ─── Dubbing Job Input & Result ───────────────────────────────────────────────

export const DubbingStatusSchema = z.enum([
  'pending',
  'extracting_audio',
  'transcribing',
  'translating',
  'synthesizing',
  'generating_subtitles',
  'completed',
  'failed',
]);
export type DubbingStatus = z.infer<typeof DubbingStatusSchema>;

export interface DubbingJobInput {
  jobId: string;
  videoId: string;
  sourceAudioR2Key?: string;
  sourceVideoUrl?: string;
  sourceLocale?: ApacLocale;
  targetLocales: ApacLocale[];
  voiceIds?: Partial<Record<ApacLocale, string>>;
  generateSubtitles?: boolean;
  tenantId: string;
  userId: string;
}

export const DubbingJobInputSchema = z.object({
  jobId: z.string().min(1),
  videoId: z.string().min(1),
  sourceAudioR2Key: z.string().optional(),
  sourceVideoUrl: z.string().url().optional(),
  sourceLocale: ApacLocaleSchema.optional().default('vi'),
  targetLocales: z.array(ApacLocaleSchema).min(1),
  voiceIds: z.record(ApacLocaleSchema, z.string()).optional(),
  generateSubtitles: z.boolean().optional().default(true),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
});

export interface DubbingJobResult {
  jobId: string;
  videoId: string;
  status: DubbingStatus;
  videoUrl?: string;
  audioTrackUrls: Partial<Record<ApacLocale, string>>;
  subtitleUrls: Partial<Record<ApacLocale, { srt: string; vtt: string }>>;
  transcription?: TranscriptWord[];
  translations?: Partial<Record<ApacLocale, string>>;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export const DubbingJobResultSchema = z.object({
  jobId: z.string().min(1),
  videoId: z.string().min(1),
  status: DubbingStatusSchema,
  videoUrl: z.string().optional(),
  audioTrackUrls: z.record(z.string(), z.string()).default({}),
  subtitleUrls: z
    .record(
      z.string(),
      z.object({
        srt: z.string(),
        vtt: z.string(),
      }),
    )
    .default({}),
  transcription: z.array(TranscriptWordSchema).optional(),
  translations: z.record(z.string(), z.string()).optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

/**
 * Interface contract matching PROJECT.md Interface Contracts:
 * M1 (Dubbing & Localization) ↔ M3 (Syndication) & M4 (HLS)
 */
export interface DubbingResult {
  jobId: string;
  videoUrl: string;
  audioTrackUrls: Record<ApacLocale, string>;
  subtitleUrls: Record<ApacLocale, { srt: string; vtt: string }>;
}
