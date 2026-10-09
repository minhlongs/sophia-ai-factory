/**
 * First-Run Wizard Mission Constraints & Execution Helper
 * Layer: components/missions (UI Presentation)
 *
 * @module components/missions/first-run/execution-helper
 */

import type { FirstRunTemplate } from '@/land/missions/first-run-template';
import type { MarketplaceBlueprintItem } from '@/seed/types/creator-marketplace';
import { executeMultiTrackMissionAction } from '@/land/creative-mission/actions';

export function buildMissionConstraints(
  tmpl: FirstRunTemplate,
  blueprint?: MarketplaceBlueprintItem | null,
) {
  const base = {
    templateId: tmpl.id,
    durationSeconds: tmpl.durationSeconds,
    estimatedScenes: tmpl.estimatedScenes,
    aspectRatio: tmpl.aspectRatio,
    voiceStyle: tmpl.voiceStyle,
    visualStyle: tmpl.visualStyle,
    targetWordCount: tmpl.targetWordCount,
    targetPlatform: tmpl.targetPlatform,
  };

  if (!blueprint) return base;

  return {
    ...base,
    blueprintId: blueprint.id,
    hookStyle: blueprint.hookStyle,
    targetPlatform: blueprint.targetPlatform,
    aspectRatio: blueprint.aspectRatios[0] || '9:16',
    estimatedScenes: blueprint.estimatedScenes,
    durationSeconds: blueprint.estimatedDurationSeconds,
  };
}

export function buildCreateMissionInput(params: {
  workspaceId: string;
  topic: string;
  template: FirstRunTemplate;
  locale: 'vi' | 'en';
  budgetCents: number;
  blueprint?: MarketplaceBlueprintItem | null;
}) {
  const { workspaceId, topic, template, locale, budgetCents, blueprint } = params;
  const now = Math.floor(Date.now() / 1000);
  const platform = blueprint?.targetPlatform ?? template.targetPlatform;
  const duration = blueprint?.estimatedDurationSeconds ?? template.durationSeconds;

  return {
    workspaceId,
    title: (topic || template.name[locale]).slice(0, 200),
    objective: `Generate autonomous ${duration}s video for ${platform}. Topic: ${topic}`,
    audience: 'General interest mobile viewers',
    geography: locale === 'vi' ? 'Vietnam' : 'Global',
    timeframeStart: now,
    timeframeEnd: now + 3600,
    budgetCents,
    autonomyLevel: 1,
    channels: [platform],
    monetizationGoals: [],
    constraints: buildMissionConstraints(template, blueprint),
    successMetrics: { views: 1000, engagement_rate: 0.05 },
  };
}

export function resolveExecutionTemplate(
  template: FirstRunTemplate,
  blueprint?: MarketplaceBlueprintItem | null,
) {
  if (!blueprint) return template;
  return {
    ...template,
    estimatedScenes: blueprint.estimatedScenes,
    durationSeconds: blueprint.estimatedDurationSeconds,
    aspectRatio: (blueprint.aspectRatios[0] as '9:16' | '16:9' | '1:1') || template.aspectRatio,
  };
}

export function triggerExecutionAction(
  missionId: string,
  topic: string,
  tmpl: { estimatedScenes: number; durationSeconds: number; aspectRatio: '9:16' | '16:9' | '1:1' },
  costUsd: number,
  isMounted: () => boolean,
  onDone: (err?: string) => void,
) {
  executeMultiTrackMissionAction({
    missionId,
    topic,
    estimatedScenes: tmpl.estimatedScenes,
    durationSeconds: tmpl.durationSeconds,
    aspectRatio: tmpl.aspectRatio,
    estimatedCostCents: Math.round(costUsd * 100),
  })
    .then((execRes) => {
      if (!isMounted()) return;
      if (!execRes.ok) {
        onDone(execRes.error.message);
      } else {
        onDone();
      }
    })
    .catch((execErr) => {
      if (!isMounted()) return;
      onDone(execErr instanceof Error ? execErr.message : String(execErr));
    });
}
