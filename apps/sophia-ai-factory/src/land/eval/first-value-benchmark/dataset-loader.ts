/**
 * Frozen JSONL dataset parser, schema validator, and SHA-256 integrity verifier.
 *
 * @module land/eval/first-value-benchmark/dataset-loader
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  BENCHMARK_VERTICALS,
  type BenchmarkVertical,
  type DatasetManifest,
  type EvaluationBrief,
} from './types';

export const EXPECTED_BRIEF_COUNT = 50;
export const EXPECTED_BRIEFS_PER_VERTICAL = 10;

const evaluationBriefSchema = z.object({
  briefId: z.string().min(4),
  industry: z.enum(BENCHMARK_VERTICALS),
  targetAudience: z.string().min(10),
  productOrService: z.string().min(8),
  intendedPlatform: z.enum(['tiktok', 'instagram_reels', 'youtube_shorts', 'facebook_reels']),
  campaignObjective: z.string().min(8),
  brandVoice: z.string().min(5),
  language: z.enum(['en', 'vi']),
  requiredCta: z.string().min(8),
  contentRestrictions: z.array(z.string().min(5)).min(1),
  expectedDeliverable: z.string().min(10),
  acceptanceRubricVersion: z.string().min(4),
});

const datasetManifestSchema = z.object({
  datasetVersion: z.string().min(4),
  datasetFile: z.string().min(1),
  datasetSha256: z.string().regex(/^[0-9a-f]{64}$/),
  briefCount: z.number().int().positive(),
  verticalCounts: z.object({
    coffee_and_food_service: z.number().int().nonnegative(),
    local_retail_and_ecommerce: z.number().int().nonnegative(),
    education_and_tutoring: z.number().int().nonnegative(),
    beauty_and_personal_services: z.number().int().nonnegative(),
    local_professional_services: z.number().int().nonnegative(),
  }),
  rubricVersion: z.string().min(4),
  rubricFile: z.string().min(1),
  rubricSha256: z.string().regex(/^[0-9a-f]{64}$/),
  frozenAtIso: z.string().min(10),
  creationProcess: z.object({
    source: z.string().min(10),
    piiPolicy: z.string().min(10),
    neutralityPolicy: z.string().min(10),
    languageCoverage: z.array(z.string().min(2)).min(1),
    platformCoverage: z.array(z.string().min(2)).min(1),
  }),
});

export function computeSha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function parseDatasetJsonl(rawJsonl: string): readonly EvaluationBrief[] {
  const lines = rawJsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const seenIds = new Set<string>();
  const briefs: EvaluationBrief[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[i]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid JSON on dataset line ${i + 1}: ${msg}`);
    }

    const result = evaluationBriefSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Schema violation on dataset line ${i + 1}: ${result.error.message}`);
    }

    if (seenIds.has(result.data.briefId)) {
      throw new Error(`Duplicate briefId "${result.data.briefId}" on dataset line ${i + 1}`);
    }
    seenIds.add(result.data.briefId);
    briefs.push(result.data);
  }

  return briefs;
}

export function parseDatasetManifest(rawJson: string): DatasetManifest {
  const parsed: unknown = JSON.parse(rawJson);
  return datasetManifestSchema.parse(parsed);
}

export function countVerticalDistribution(
  briefs: readonly EvaluationBrief[],
): Readonly<Record<BenchmarkVertical, number>> {
  const counts: Record<BenchmarkVertical, number> = {
    coffee_and_food_service: 0,
    local_retail_and_ecommerce: 0,
    education_and_tutoring: 0,
    beauty_and_personal_services: 0,
    local_professional_services: 0,
  };
  for (const brief of briefs) {
    counts[brief.industry] += 1;
  }
  return counts;
}

export interface VerifiedDatasetBundle {
  readonly manifest: DatasetManifest;
  readonly briefs: readonly EvaluationBrief[];
  readonly actualDatasetSha256: string;
  readonly verticalCounts: Readonly<Record<BenchmarkVertical, number>>;
}

export function verifyFrozenDataset(
  rawDatasetJsonl: string,
  rawManifestJson: string,
): VerifiedDatasetBundle {
  const manifest = parseDatasetManifest(rawManifestJson);
  const actualDatasetSha256 = computeSha256Hex(rawDatasetJsonl);
  if (actualDatasetSha256 !== manifest.datasetSha256) {
    throw new Error(
      `Dataset SHA-256 mismatch: expected ${manifest.datasetSha256}, computed ${actualDatasetSha256}`,
    );
  }

  const briefs = parseDatasetJsonl(rawDatasetJsonl);
  if (briefs.length !== EXPECTED_BRIEF_COUNT || briefs.length !== manifest.briefCount) {
    throw new Error(
      `Dataset brief count mismatch: expected ${EXPECTED_BRIEF_COUNT}, got ${briefs.length}`,
    );
  }

  const verticalCounts = countVerticalDistribution(briefs);
  for (const vertical of BENCHMARK_VERTICALS) {
    if (
      verticalCounts[vertical] !== EXPECTED_BRIEFS_PER_VERTICAL ||
      manifest.verticalCounts[vertical] !== EXPECTED_BRIEFS_PER_VERTICAL
    ) {
      throw new Error(
        `Vertical "${vertical}" must contain exactly ${EXPECTED_BRIEFS_PER_VERTICAL} briefs, got ${verticalCounts[vertical]}`,
      );
    }
  }

  for (const brief of briefs) {
    if (brief.acceptanceRubricVersion !== manifest.rubricVersion) {
      throw new Error(
        `Brief "${brief.briefId}" references rubric "${brief.acceptanceRubricVersion}", expected "${manifest.rubricVersion}"`,
      );
    }
  }

  return { manifest, briefs, actualDatasetSha256, verticalCounts };
}
