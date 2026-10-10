/**
 * YouTube Strategy Learning Engine Types & Contracts
 *
 * Layer: tree/youtube-strategy/engine
 */

export interface PerformanceMetrics {
  readonly views: number;
  readonly impressions: number;
  readonly ctr: number;
  readonly retention: number;
  readonly averageViewDuration: number;
  readonly watchMinutes: number;
  readonly engagementRate: number;
  readonly performanceScore: number;
}

export interface ContentAttributes {
  readonly topic: string;
  readonly format: string;
  readonly length: string;
  readonly hookLength: string;
  readonly titleLength: string;
  readonly thumbnailStyle: string;
  readonly source: 'autonomous_operator' | 'manual';
}

export interface PerformanceSnapshot {
  readonly videoId: string;
  readonly productionId: string | null;
  readonly measurementWindow: string;
  readonly publishedAt: string | null;
  readonly metrics: PerformanceMetrics;
  readonly contentAttributes: ContentAttributes;
  readonly baseline: Record<string, number>;
  readonly deltas: Record<string, number | null>;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly simulated: boolean;
}

export interface LearningRecommendation {
  readonly category: string;
  readonly title: string;
  readonly rationale: string;
  readonly evidence: Record<string, unknown>;
  readonly proposedChange: Record<string, unknown>;
  readonly confidence: 'high' | 'medium';
  readonly status: 'pending' | 'approved' | 'rejected';
}

export interface LearningSnapshotStore {
  listPerformanceSnapshots(options: {
    measurementWindow?: string;
    reliableOnly?: boolean;
    excludeVideoId?: string;
  }): Promise<PerformanceSnapshot[]>;
  savePerformanceSnapshot(data: Partial<PerformanceSnapshot>): Promise<PerformanceSnapshot>;
  saveLearningRecommendation(data: Partial<LearningRecommendation>): Promise<LearningRecommendation>;
  listLearningRecommendations(options: {
    status?: string;
    limit?: number;
  }): Promise<LearningRecommendation[]>;
}
