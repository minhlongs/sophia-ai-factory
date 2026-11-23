import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_VERTICALS,
  computeMeanCriterionScore,
  computeSha256Hex,
  parseDatasetJsonl,
  parseDatasetManifest,
  RUBRIC_CRITERIA,
  validateReviewerScore,
  verifyFrozenDataset,
  verifyFrozenRubric,
} from '../index';

const EVAL_DIR = resolve(process.cwd(), 'eval/b4-first-value');

function loadFrozenFiles(): { datasetRaw: string; rubricRaw: string; manifestRaw: string } {
  return {
    datasetRaw: readFileSync(resolve(EVAL_DIR, 'dataset-v1.jsonl'), 'utf8'),
    rubricRaw: readFileSync(resolve(EVAL_DIR, 'rubric-v1.json'), 'utf8'),
    manifestRaw: readFileSync(resolve(EVAL_DIR, 'dataset-manifest.json'), 'utf8'),
  };
}

describe('B4 Frozen Dataset & Rubric Integrity', () => {
  it('verifies frozen dataset count (50), schema, 5x10 vertical distribution, and SHA-256 hash', () => {
    const { datasetRaw, manifestRaw } = loadFrozenFiles();
    const verified = verifyFrozenDataset(datasetRaw, manifestRaw);

    expect(verified.briefs).toHaveLength(50);
    expect(verified.actualDatasetSha256).toBe(verified.manifest.datasetSha256);
    expect(verified.actualDatasetSha256).toMatch(/^[a-f0-9]{64}$/);
    for (const vertical of BENCHMARK_VERTICALS) {
      expect(verified.verticalCounts[vertical]).toBe(10);
    }
  });

  it('rejects tampered dataset content via SHA-256 immutability check', () => {
    const { datasetRaw, manifestRaw } = loadFrozenFiles();
    const tampered = `${datasetRaw}\n`;

    expect(() => verifyFrozenDataset(tampered, manifestRaw)).toThrow(/SHA-256 mismatch/);
  });

  it('rejects duplicate briefId entries in JSONL', () => {
    const { datasetRaw } = loadFrozenFiles();
    const firstLine = datasetRaw.trim().split('\n')[0];
    expect(() => parseDatasetJsonl(`${firstLine}\n${firstLine}`)).toThrow(/Duplicate briefId/);
  });

  it('contains zero customer PII and zero Sophia-biased prompt phrasing', () => {
    const { datasetRaw } = loadFrozenFiles();
    expect(datasetRaw).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    expect(datasetRaw).not.toMatch(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/);
    expect(datasetRaw.toLowerCase()).not.toContain('sophia');
    expect(datasetRaw.toLowerCase()).not.toContain('scene_number');
  });

  it('verifies frozen 5-criterion rubric schema and SHA-256 hash', () => {
    const { rubricRaw, manifestRaw } = loadFrozenFiles();
    const manifest = parseDatasetManifest(manifestRaw);
    const { rubric, actualRubricSha256 } = verifyFrozenRubric(rubricRaw, manifest.rubricSha256);

    expect(actualRubricSha256).toBe(manifest.rubricSha256);
    expect(rubric.rubricVersion).toBe(manifest.rubricVersion);
    expect(rubric.criteria).toHaveLength(5);
    expect(rubric.criteria.map((c) => c.id)).toEqual([...RUBRIC_CRITERIA]);
    expect(rubric.acceptancePolicy.humanAcceptanceRequiredForClaims).toBe(true);
    expect(() => verifyFrozenRubric(rubricRaw, computeSha256Hex('wrong'))).toThrow(/SHA-256 mismatch/);
  });

  it('validates reviewer scores, rejection reasons, thresholds, and scoring origin labeling', () => {
    const { rubricRaw, manifestRaw } = loadFrozenFiles();
    const manifest = parseDatasetManifest(manifestRaw);
    const { rubric } = verifyFrozenRubric(rubricRaw, manifest.rubricSha256);

    const accepted = validateReviewerScore(
      {
        reviewerId: 'rev-01',
        blindOutputId: 'blind-0001-abc123',
        rubricVersion: rubric.rubricVersion,
        scoringOrigin: 'human_independent',
        criterionScores: {
          hook_clarity: 4,
          logical_structure: 4,
          cta_relevance: 5,
          brand_and_audience_fit: 4,
          compliance_and_publishability: 5,
        },
        accepted: true,
        rejectionReason: null,
        estimatedEditingMinutes: 3,
        founderSupportMinutes: 0,
      },
      rubric,
    );
    expect(accepted.accepted).toBe(true);
    expect(computeMeanCriterionScore(accepted.criterionScores)).toBe(4.4);

    // Rejected without reason must fail
    expect(() =>
      validateReviewerScore(
        {
          ...accepted,
          accepted: false,
          rejectionReason: null,
        },
        rubric,
      ),
    ).toThrow(/non-empty rejectionReason/);

    // Accepted with compliance below 4 must fail
    expect(() =>
      validateReviewerScore(
        {
          ...accepted,
          criterionScores: { ...accepted.criterionScores, compliance_and_publishability: 3 },
        },
        rubric,
      ),
    ).toThrow(/compliance threshold/);

    // Automated grading must be explicitly labeled and preserved
    const automated = validateReviewerScore(
      {
        ...accepted,
        reviewerId: 'auto-grader-v1',
        scoringOrigin: 'automated_model_graded',
        accepted: false,
        rejectionReason: 'Automated check flagged weak hook',
      },
      rubric,
    );
    expect(automated.scoringOrigin).toBe('automated_model_graded');
  });
});
