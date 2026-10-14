/**
 * Creator Marketplace Template Evaluation & Service Contracts
 *
 * Layer: tree/marketplace/types
 */

import type {
  AspectRatio,
  TargetPlatform,
  TemplateSortOrder,
  TemplateStatus,
} from './enums';
import type { CreatorTemplate } from './entities';

export interface TemplateEvaluationInput {
  title: string;
  scriptTemplate: string;
  hookStyle?: string;
  storyboardJson?: string | Array<{
    sceneNumber?: number;
    durationSeconds?: number;
    visualPrompt?: string;
    voiceoverScript?: string;
  }>;
  aspectRatio?: string;
  niche?: string;
  targetPlatform?: string;
  visualStylePrompt?: string;
  estimatedDurationSeconds?: number;
}

export interface DimensionScore {
  score: number;
  maxScore: number;
  details: Record<string, string | number | boolean>;
}

export interface QualityDimensionBreakdown {
  hookStrength: DimensionScore;
  storyboardCoherence: DimensionScore;
  scriptCadence: DimensionScore;
  nicheFit: DimensionScore;
}

export interface QualityScoreResult {
  totalScore: number;
  status: 'approved' | 'pending' | 'rejected';
  dimensions: QualityDimensionBreakdown;
  feedback: string[];
}

export interface TemplateQueryFilter {
  niche?: string;
  targetPlatform?: string;
  status?: TemplateStatus;
  minPriceCents?: number;
  maxPriceCents?: number;
  search?: string;
  sortBy?: TemplateSortOrder;
  page?: number;
  pageSize?: number;
}

export interface CreatorTemplateItem extends CreatorTemplate {
  trendingScore?: number;
}

export interface PaginatedTemplates {
  items: CreatorTemplateItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateTemplateInput {
  creatorId: string;
  tenantId: string;
  title: string;
  description?: string;
  niche?: string;
  targetPlatform?: TargetPlatform;
  aspectRatio?: AspectRatio;
  hookStyle?: string;
  scriptTemplate: string;
  storyboardJson?: string;
  visualStylePrompt: string;
  musicPrompt?: string;
  voiceProfile?: string;
  priceCents?: number;
}

export interface SubmitReviewInput {
  templateId: string;
  userId: string;
  tenantId: string;
  rating: number;
  reviewText?: string;
}

export interface SubmitReviewResult {
  success: boolean;
  reviewId: string;
  newRating: number;
  newReviewCount: number;
  error?: string;
}
