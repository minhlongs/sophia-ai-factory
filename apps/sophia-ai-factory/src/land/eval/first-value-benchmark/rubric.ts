/**
 * Blind acceptance rubric loader, hash verifier, and reviewer score validator.
 *
 * @module land/eval/first-value-benchmark/rubric
 */

import { z } from 'zod';
import { computeSha256Hex } from './dataset-loader';
import {
  RUBRIC_CRITERIA,
  type ReviewerScoreRecord,
  type RubricCriterionId,
  type RubricDefinition,
} from './types';

const anchorSchema = z.object({
  '1': z.string().min(10),
  '2': z.string().min(10),
  '3': z.string().min(10),
  '4': z.string().min(10),
  '5': z.string().min(10),
});

const rubricSchema = z.object({
  rubricVersion: z.string().min(4),
  title: z.string().min(5),
  scale: z.object({
    min: z.literal(1),
    max: z.literal(5),
    integerOnly: z.literal(true),
  }),
  acceptancePolicy: z.object({
    description: z.string().min(10),
    minimumCriterionScore: z.number().int().min(1).max(5),
    minimumComplianceScore: z.number().int().min(1).max(5),
    humanAcceptanceRequiredForClaims: z.literal(true),
  }),
  criteria: z
    .array(
      z.object({
        id: z.enum(RUBRIC_CRITERIA),
        label: z.string().min(3),
        description: z.string().min(10),
        anchors: anchorSchema,
      }),
    )
    .length(RUBRIC_CRITERIA.length),
});

const scoreValueSchema = z.number().int().min(1).max(5);

const reviewerScoreSchema = z.object({
  reviewerId: z.string().min(2),
  blindOutputId: z.string().min(4),
  rubricVersion: z.string().min(4),
  scoringOrigin: z.enum(['human_independent', 'automated_model_graded']),
  criterionScores: z.object({
    hook_clarity: scoreValueSchema,
    logical_structure: scoreValueSchema,
    cta_relevance: scoreValueSchema,
    brand_and_audience_fit: scoreValueSchema,
    compliance_and_publishability: scoreValueSchema,
  }),
  accepted: z.boolean(),
  rejectionReason: z.string().min(3).nullable(),
  estimatedEditingMinutes: z.number().finite().min(0).max(600),
  founderSupportMinutes: z.number().finite().min(0).max(600).optional(),
});

export interface VerifiedRubricBundle {
  readonly rubric: RubricDefinition;
  readonly actualRubricSha256: string;
}

export function verifyFrozenRubric(
  rawRubricJson: string,
  expectedSha256: string,
): VerifiedRubricBundle {
  const actualRubricSha256 = computeSha256Hex(rawRubricJson);
  if (actualRubricSha256 !== expectedSha256) {
    throw new Error(
      `Rubric SHA-256 mismatch: expected ${expectedSha256}, computed ${actualRubricSha256}`,
    );
  }
  const parsed: unknown = JSON.parse(rawRubricJson);
  const rubric = rubricSchema.parse(parsed);
  const uniqueIds = new Set(rubric.criteria.map((c) => c.id));
  if (uniqueIds.size !== RUBRIC_CRITERIA.length) {
    throw new Error('Rubric criteria must contain all five unique criterion IDs');
  }
  return { rubric, actualRubricSha256 };
}

export function validateReviewerScore(
  input: unknown,
  rubric: RubricDefinition,
): ReviewerScoreRecord {
  const parsed = reviewerScoreSchema.parse(input);
  if (parsed.rubricVersion !== rubric.rubricVersion) {
    throw new Error(
      `Reviewer score rubricVersion "${parsed.rubricVersion}" does not match "${rubric.rubricVersion}"`,
    );
  }
  if (!parsed.accepted && (!parsed.rejectionReason || !parsed.rejectionReason.trim())) {
    throw new Error(`Rejected score for "${parsed.blindOutputId}" must include a non-empty rejectionReason`);
  }
  if (parsed.accepted && parsed.rejectionReason !== null) {
    throw new Error(`Accepted score for "${parsed.blindOutputId}" must have rejectionReason: null`);
  }
  if (parsed.accepted) {
    const policy = rubric.acceptancePolicy;
    for (const id of RUBRIC_CRITERIA) {
      const score = parsed.criterionScores[id];
      if (score < policy.minimumCriterionScore) {
        throw new Error(
          `Accepted score for "${parsed.blindOutputId}" violates minimum criterion score (${id}=${score} < ${policy.minimumCriterionScore})`,
        );
      }
    }
    const compliance = parsed.criterionScores.compliance_and_publishability;
    if (compliance < policy.minimumComplianceScore) {
      throw new Error(
        `Accepted score for "${parsed.blindOutputId}" violates compliance threshold (${compliance} < ${policy.minimumComplianceScore})`,
      );
    }
  }
  return parsed;
}

export function computeMeanCriterionScore(
  scores: Readonly<Record<RubricCriterionId, number>>,
): number {
  let sum = 0;
  for (const id of RUBRIC_CRITERIA) {
    sum += scores[id];
  }
  return Math.round((sum / RUBRIC_CRITERIA.length) * 100) / 100;
}
