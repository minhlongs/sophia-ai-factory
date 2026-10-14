/**
 * Evidence grouping helpers for trend detection.
 */

import type { MarketSignal, PerformanceEvent } from '@/seed/types/creative-domain';
import { topicsFromText, type EvidencePoint } from './detect-math';

export interface TopicGroup {
  readonly channel: string;
  readonly topic: string;
  readonly points: EvidencePoint[];
}

/** Signals contribute keyword topics from their titles, keyed by source channel. */
function addSignalPoints(groups: Map<string, TopicGroup>, signal: MarketSignal): void {
  const topics = topicsFromText(signal.title);
  for (const topic of topics) {
    const key = `${signal.source}::${topic}`;
    const group = groups.get(key) ?? { channel: signal.source, topic, points: [] };
    group.points.push({ id: signal.id, atMs: signal.createdAt });
    groups.set(key, group);
  }
}

/** Performance events contribute one topic per eventType, keyed by channel. */
function addEventPoints(groups: Map<string, TopicGroup>, event: PerformanceEvent): void {
  const channel = event.channel || 'unknown';
  const key = `${channel}::${event.eventType}`;
  const group = groups.get(key) ?? { channel, topic: event.eventType, points: [] };
  group.points.push({ id: event.id, atMs: event.recordedAt });
  groups.set(key, group);
}

export function groupEvidence(
  signals: readonly MarketSignal[],
  events: readonly PerformanceEvent[],
): Map<string, TopicGroup> {
  const groups = new Map<string, TopicGroup>();
  for (const signal of signals) addSignalPoints(groups, signal);
  for (const event of events) addEventPoints(groups, event);
  return groups;
}

export function newTrendDetectionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'tdet_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
