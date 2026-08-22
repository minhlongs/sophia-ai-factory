/**
 * Per-video performance capture and evidence-backed recommendations.
 * Ported from Lumen's channel-learning-engine.
 */

import { logger } from '@/seed/utils/logger-utility';

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

/**
 * Capture performance data for a video into a normalized snapshot.
 */
export function normalizeMetrics(report: {
  analytics?: Record<string, unknown>;
  thumbnailMetrics?: Record<string, unknown>;
  performance?: Record<string, unknown>;
}): PerformanceMetrics {
  const analytics = report.analytics ?? {};
  const views = (analytics.views as Record<string, unknown>) ?? {};
  const watchTime = (analytics.watchTime as Record<string, unknown>) ?? {};
  const engagement = (analytics.engagement as Record<string, unknown>) ?? {};

  return {
    views: number(views.totalViews),
    impressions: number(views.totalImpressions ?? report.thumbnailMetrics?.impressions),
    ctr: number(report.thumbnailMetrics?.clickThroughRate ?? views.averageCTR),
    retention: number(watchTime.averageViewPercentage),
    averageViewDuration: number(watchTime.averageViewDuration),
    watchMinutes: number(watchTime.totalWatchTime),
    engagementRate: number(engagement.engagementRate),
    performanceScore: number(report.performance?.score),
  };
}

/**
 * Extract content attributes from performance report and context.
 */
export function extractAttributes(
  report: {
    videoDetails?: Record<string, unknown>;
  },
  context: {
    strategy?: Record<string, unknown>;
    script?: Record<string, unknown>;
    thumbnail?: Record<string, unknown>;
    title?: string;
  },
): ContentAttributes {
  const strategy = context.strategy ?? {};
  const script = context.script ?? {};
  const thumbnail = context.thumbnail ?? {};
  const title =
    String(report.videoDetails?.title ?? context.title ?? script.title ?? '').trim();
  const hook = text(script.hook ?? script.introduction ?? '');
  const concept = (thumbnail as Record<string, unknown>).concept as Record<string, unknown> | undefined;
  const thumbnailStyle = slug(
    String(
      concept?.composition ??
        concept?.style ??
        (thumbnail as Record<string, unknown>).style ??
        'unknown',
    ),
  );

  return {
    topic: String(strategy.topic ?? ''),
    format: slug(String(strategy.requestedStyle ?? strategy.contentType ?? 'unknown')),
    length: slug(String(strategy.requestedLengthKey ?? strategy.requestedLength ?? 'unknown')),
    hookLength: hook ? (wordCount(hook) <= 40 ? 'concise' : 'extended') : 'unknown',
    titleLength: title ? (wordCount(title) <= 9 ? 'concise' : 'long') : 'unknown',
    thumbnailStyle,
    source: strategy.planRationale ? 'autonomous_operator' : 'manual',
  };
}

/**
 * Calculate baseline metrics from a list of prior snapshots.
 */
export function calculateBaseline(snapshots: readonly PerformanceSnapshot[]): Record<string, number> {
  const keys: (keyof PerformanceMetrics)[] = [
    'views',
    'impressions',
    'ctr',
    'retention',
    'averageViewDuration',
    'watchMinutes',
    'engagementRate',
    'performanceScore',
  ];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      median(
        snapshots
          .map((s) => s.metrics[key])
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v)),
      ),
    ]),
  );
}

/**
 * Calculate percentage deltas between current metrics and baseline.
 */
export function calculateDeltas(
  metrics: PerformanceMetrics,
  baseline: Record<string, number>,
): Record<string, number | null> {
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => {
      const reference = number(baseline[key]);
      return [
        key,
        reference > 0
          ? Number((((value - reference) / reference) * 100).toFixed(1))
          : null,
      ];
    }),
  );
}

/**
 * Determine confidence level based on impression and view counts.
 */
export function confidenceFor(metrics: PerformanceMetrics): 'high' | 'medium' | 'low' {
  if (metrics.impressions >= 1000 && metrics.views >= 100) return 'high';
  if (metrics.impressions >= 100 && metrics.views >= 20) return 'medium';
  return 'low';
}

/**
 * Build evidence-backed recommendations from a set of snapshots.
 */
export function buildRecommendations(snapshots: readonly PerformanceSnapshot[]): LearningRecommendation[] {
  const preferred = preferredSnapshotPerVideo(snapshots);
  if (preferred.length < 2) return [];
  return [...buildDimensionRecommendations(preferred), ...buildChannelRecommendations(preferred)];
}

function preferredSnapshotPerVideo(snapshots: readonly PerformanceSnapshot[]): PerformanceSnapshot[] {
  const rank: Record<string, number> = { '7d': 3, '24h': 2, rolling: 1 };
  const selected = new Map<string, PerformanceSnapshot>();
  for (const snapshot of snapshots) {
    const current = selected.get(snapshot.videoId);
    if (
      !current ||
      (rank[snapshot.measurementWindow] ?? 0) > (rank[current.measurementWindow] ?? 0)
    ) {
      selected.set(snapshot.videoId, snapshot);
    }
  }
  return [...selected.values()];
}

function buildDimensionRecommendations(
  snapshots: readonly PerformanceSnapshot[],
): LearningRecommendation[] {
  const dimensions = [
    { key: 'format', metric: 'performanceScore', label: 'format', minimumDifference: 10 },
    { key: 'length', metric: 'retention', label: 'video length', minimumDifference: 8 },
    { key: 'hookLength', metric: 'retention', label: 'hook style', minimumDifference: 8 },
    { key: 'titleLength', metric: 'ctr', label: 'title style', minimumDifference: 1.25 },
  ];
  const recommendations: LearningRecommendation[] = [];

  for (const dimension of dimensions) {
    const groups = new Map<string, number[]>();
    for (const snapshot of snapshots) {
      const value = snapshot.contentAttributes[dimension.key as keyof ContentAttributes];
      const metric = number(snapshot.metrics[dimension.metric as keyof PerformanceMetrics]);
      if (!value || value === 'unknown' || !Number.isFinite(metric)) continue;
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value)!.push(metric);
    }
    const ranked = [...groups.entries()]
      .filter(([, values]) => values.length >= 2)
      .map(([value, values]) => ({
        value,
        count: values.length,
        average: average(values),
      }))
      .sort((a, b) => b.average - a.average);
    if (ranked.length < 2 || ranked[0].average - ranked[ranked.length - 1].average < dimension.minimumDifference) continue;

    const best = ranked[0];
    const weakest = ranked[ranked.length - 1];
    const metricLabel =
      dimension.metric === 'ctr'
        ? 'CTR'
        : dimension.metric === 'retention'
          ? 'retention'
          : 'performance score';
    recommendations.push({
      category: dimension.key,
      title: `Favor ${readable(best.value)} over ${readable(weakest.value)} ${dimension.label}`,
      rationale: `${readable(best.value)} ${dimension.label} averaged ${metric(best.average, dimension.metric)} ${metricLabel} across ${best.count} videos versus ${metric(weakest.average, dimension.metric)} across ${weakest.count}.`,
      evidence: { dimension: dimension.key, metric: dimension.metric, best, weakest },
      proposedChange: {
        target: 'future_plans',
        dimension: dimension.key,
        prefer: best.value,
        deprioritize: weakest.value,
      },
      confidence: best.count >= 4 && weakest.count >= 4 ? 'high' : 'medium',
      status: 'pending',
    });
  }
  return recommendations;
}

function buildChannelRecommendations(
  snapshots: readonly PerformanceSnapshot[],
): LearningRecommendation[] {
  const sufficientlyExposed = snapshots.filter(
    (s) => number(s.metrics.impressions) >= 100,
  );
  if (sufficientlyExposed.length < 2) return [];
  const averageCTR = average(sufficientlyExposed.map((s) => number(s.metrics.ctr)));
  const averageRetention = average(sufficientlyExposed.map((s) => number(s.metrics.retention)));
  const recommendations: LearningRecommendation[] = [];

  if (averageCTR < 4) {
    recommendations.push({
      category: 'packaging',
      title: 'Test new title and thumbnail packaging',
      rationale: `Channel CTR averaged ${averageCTR.toFixed(1)}% across ${sufficientlyExposed.length} sufficiently exposed videos.`,
      evidence: {
        metric: 'ctr',
        average: averageCTR,
        sampleSize: sufficientlyExposed.length,
        minimumImpressions: 100,
      },
      proposedChange: { target: 'review', experiment: 'title_thumbnail_variant' },
      confidence: sufficientlyExposed.length >= 5 ? 'high' : 'medium',
      status: 'pending',
    });
  }
  if (averageRetention < 35) {
    recommendations.push({
      category: 'retention',
      title: 'Tighten hooks and early pacing',
      rationale: `Average view percentage was ${averageRetention.toFixed(1)}% across ${sufficientlyExposed.length} sufficiently exposed videos.`,
      evidence: { metric: 'retention', average: averageRetention, sampleSize: sufficientlyExposed.length },
      proposedChange: { target: 'future_scripts', prefer: 'concise_hook_and_faster_opening' },
      confidence: sufficientlyExposed.length >= 5 ? 'high' : 'medium',
      status: 'pending',
    });
  }
  return recommendations;
}

/**
 * Determine which measurement windows are due for a video.
 */
export function getDueMeasurementWindows(
  video: { published_at?: string; youtube_id?: string; youtubeId?: string },
  existingSnapshots: readonly PerformanceSnapshot[],
): string[] {
  const published = new Date(video.published_at ?? video.youtubeId ?? video.youtube_id ?? '');
  if (Number.isNaN(published.getTime())) return [];
  const ageHours = (Date.now() - published.getTime()) / 3600000;
  const existing = new Set(
    existingSnapshots
      .filter((s) => s.videoId === (video.youtube_id ?? video.youtubeId))
      .map((s) => s.measurementWindow),
  );
  const windows: string[] = [];
  if (ageHours >= 24 && !existing.has('24h')) windows.push('24h');
  if (ageHours >= 168 && !existing.has('7d')) windows.push('7d');
  return windows;
}

/**
 * Calculate measurement period for a given window.
 */
export function measurementPeriod(
  publishedAt: string | null,
  measurementWindow: string,
): { startDate: string; endDate: string } | null {
  if (!['24h', '7d'].includes(measurementWindow) || !publishedAt) return null;
  const start = new Date(publishedAt);
  if (Number.isNaN(start.getTime())) return null;
  const days = measurementWindow === '24h' ? 1 : 7;
  const end = new Date(
    Math.min(Date.now(), start.getTime() + days * 86400000),
  );
  return { startDate: date(start), endDate: date(end) };
}

function number(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => text(item)).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map((item) => text(item)).join(' ');
  return '';
}

function wordCount(value: string): number {
  return String(value).trim().split(/\s+/).filter(Boolean).length;
}

function slug(value: string): string {
  return String(value ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'unknown';
}

function readable(value: string): string {
  return String(value).replaceAll('_', ' ');
}

function date(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function metric(value: number, metricName: string): string {
  return metricName === 'performanceScore' ? value.toFixed(0) : `${value.toFixed(1)}%`;
}