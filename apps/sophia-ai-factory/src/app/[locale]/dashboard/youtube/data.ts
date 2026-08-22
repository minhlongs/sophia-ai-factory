/**
 * Server-side data access for the YouTube content pipeline dashboard.
 * Reads from D1 tables created by migration 20260822_01.
 * All queries are ownership-checked by userId.
 */

import { getD1 } from '@/seed/db/client';
import type { CalendarStatus } from '@/land/youtube/content-calendar';
import type { ChannelConfig } from '@/land/youtube/channel-config-types';
import { rowToConfig } from '@/land/youtube/channel-config-types';

export interface StrategyRow {
  readonly id: string;
  readonly topic: string;
  readonly angle: string | null;
  readonly targetAudience: string | null;
  readonly contentType: string | null;
  readonly keywords: string | null;
  readonly estimatedViews: number;
  readonly source: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface ScriptRow {
  readonly id: string;
  readonly strategyId: string | null;
  readonly title: string;
  readonly hook: string | null;
  readonly introduction: string | null;
  readonly mainContent: string | null;
  readonly conclusion: string | null;
  readonly callToAction: string | null;
  readonly duration: string | null;
  readonly tone: string | null;
  readonly pacing: string | null;
  readonly status: string;
  readonly createdAt: string;
}

export interface CalendarRow {
  readonly id: string;
  readonly title: string;
  readonly topic: string | null;
  readonly contentType: string | null;
  readonly status: CalendarStatus;
  readonly scheduledAt: string;
  readonly notes: string | null;
  readonly createdAt: string;
}

export interface SnapshotRow {
  readonly id: string;
  readonly videoId: string;
  readonly measurementWindow: string;
  readonly metrics: string;
  readonly confidence: string;
  readonly createdAt: string;
}

export interface RecommendationRow {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly rationale: string | null;
  readonly evidence: string | null;
  readonly proposedChange: string | null;
  readonly confidence: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly createdAt: string;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToStrategy(row: Record<string, unknown>): StrategyRow {
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

function rowToScript(row: Record<string, unknown>): ScriptRow {
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

function rowToCalendar(row: Record<string, unknown>): CalendarRow {
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

function rowToSnapshot(row: Record<string, unknown>): SnapshotRow {
  return {
    id: String(row.id),
    videoId: String(row.video_id ?? ''),
    measurementWindow: String(row.measurement_window ?? ''),
    metrics: String(row.metrics ?? '{}'),
    confidence: String(row.confidence ?? 'low'),
    createdAt: String(row.created_at ?? ''),
  };
}

function rowToRecommendation(row: Record<string, unknown>): RecommendationRow {
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

export async function listChannelConfigsForUser(
  userId: string,
): Promise<readonly ChannelConfig[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_channel_configs WHERE user_id = ?1 AND is_active = 1 ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToConfig);
}

export async function listRecentCalendarEntries(
  userId: string,
  limit = 10,
): Promise<readonly CalendarRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_content_calendar WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToCalendar);
}

export async function listUpcomingCalendarEntries(
  userId: string,
): Promise<readonly CalendarRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_content_calendar
       WHERE user_id = ?1 AND status IN ('scheduled','generating','ready')
       ORDER BY scheduled_at ASC`,
    )
    .bind(userId)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToCalendar);
}

export async function listStrategies(
  userId: string,
  limit = 20,
): Promise<readonly StrategyRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_content_strategies WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToStrategy);
}

export async function listScripts(
  userId: string,
  limit = 20,
): Promise<readonly ScriptRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_scripts WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToScript);
}

export async function getScriptById(
  scriptId: string,
  userId: string,
): Promise<ScriptRow | null> {
  const db = await getD1();
  if (!db) return null;
  const row = await db
    .prepare(`SELECT * FROM youtube_scripts WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(scriptId, userId)
    .first<Record<string, unknown>>();
  return row ? rowToScript(row) : null;
}

export async function listSnapshots(
  userId: string,
  limit = 100,
): Promise<readonly SnapshotRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_learning_snapshots WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToSnapshot);
}

export async function listRecommendations(
  userId: string,
  limit = 50,
): Promise<readonly RecommendationRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_learning_recommendations WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToRecommendation);
}

export { parseJson };
