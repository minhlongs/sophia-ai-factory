import type { CalendarStatus } from '@/land/youtube/content-calendar';
import type {
  StrategyRow,
  ScriptRow,
  CalendarRow,
  SnapshotRow,
  RecommendationRow,
} from './types';

export function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function rowToStrategy(row: Record<string, unknown>): StrategyRow {
  return {
    id: String(row.id),
    topic: String(row.topic ?? ''),
    angle: row.angle == null ? null : String(row.angle),
    targetAudience: row.target_audience == null ? null : String(row.target_audience),
    contentType: row.content_type == null ? null : String(row.content_type),
    keywords: row.keywords == null ? null : String(row.keywords),
    estimatedViews: Number(row.estimated_views) || 0,
    source: String(row.source ?? 'template'),
    status: String(row.status ?? 'generated'),
    createdAt: String(row.created_at ?? ''),
  };
}

export function rowToScript(row: Record<string, unknown>): ScriptRow {
  return {
    id: String(row.id),
    strategyId: row.strategy_id == null ? null : String(row.strategy_id),
    title: String(row.title ?? ''),
    hook: row.hook == null ? null : String(row.hook),
    introduction: row.introduction == null ? null : String(row.introduction),
    mainContent: row.main_content == null ? null : String(row.main_content),
    conclusion: row.conclusion == null ? null : String(row.conclusion),
    callToAction: row.call_to_action == null ? null : String(row.call_to_action),
    duration: row.duration == null ? null : String(row.duration),
    tone: row.tone == null ? null : String(row.tone),
    pacing: row.pacing == null ? null : String(row.pacing),
    status: String(row.status ?? 'generated'),
    createdAt: String(row.created_at ?? ''),
  };
}

export function rowToCalendar(row: Record<string, unknown>): CalendarRow {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    topic: row.topic == null ? null : String(row.topic),
    contentType: row.content_type == null ? null : String(row.content_type),
    status: String(row.status ?? 'scheduled') as CalendarStatus,
    scheduledAt: String(row.scheduled_at ?? ''),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: String(row.created_at ?? ''),
  };
}

export function rowToSnapshot(row: Record<string, unknown>): SnapshotRow {
  return {
    id: String(row.id),
    videoId: String(row.video_id ?? ''),
    measurementWindow: String(row.measurement_window ?? ''),
    metrics: String(row.metrics ?? '{}'),
    confidence: String(row.confidence ?? 'low'),
    createdAt: String(row.created_at ?? ''),
  };
}

export function rowToRecommendation(row: Record<string, unknown>): RecommendationRow {
  return {
    id: String(row.id),
    category: String(row.category ?? ''),
    title: String(row.title ?? ''),
    rationale: row.rationale == null ? null : String(row.rationale),
    evidence: row.evidence == null ? null : String(row.evidence),
    proposedChange: row.proposed_change == null ? null : String(row.proposed_change),
    confidence: String(row.confidence ?? 'medium'),
    status: String(row.status ?? 'pending') as RecommendationRow['status'],
    createdAt: String(row.created_at ?? ''),
  };
}
