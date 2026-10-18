/**
 * APAC Video Dubbing & Multi-Language Subtitles Engine Contracts
 *
 * Layer: seed (pure types, schemas, and primitives)
 * Dependencies: zod
 *
 * @module seed/types/dubbing
 */

import { z } from 'zod';
import {
  APAC_LOCALES,
  type ApacLocale,
  ApacLocaleSchema,
  type TranscriptWord,
  TranscriptWordSchema,
  DubbingStatusSchema,
  type DubbingStatus,
  type DubbingJobInput,
  DubbingJobInputSchema,
  type DubbingJobResult,
  DubbingJobResultSchema,
  type DubbingResult,
} from './dubbing-job-schemas';

export const SubtitleFormatSchema = z.enum(['srt', 'vtt']);
export type SubtitleFormat = z.infer<typeof SubtitleFormatSchema>;

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

export {
  APAC_LOCALES,
  type ApacLocale,
  ApacLocaleSchema,
  type TranscriptWord,
  TranscriptWordSchema,
  DubbingStatusSchema,
  type DubbingStatus,
  type DubbingJobInput,
  DubbingJobInputSchema,
  type DubbingJobResult,
  DubbingJobResultSchema,
  type DubbingResult,
};
