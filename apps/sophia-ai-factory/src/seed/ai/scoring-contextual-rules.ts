/**
 * Contextual scoring helper rules for image edit and cinematic video signals.
 *
 * @module seed/ai/scoring-contextual-rules
 */

import { tokenizeText, expandSynonyms } from './scoring-helpers';
import type { TaskContext, ToolInfo } from './provider-scoring-types';
import type { ContextualInputs, ContextualOutputs } from './scoring-contextual';

/**
 * Apply image-edit capability bonus/penalty and cinematic video bonus.
 */
export function applySecondaryContextualRules(
  tool: ToolInfo,
  taskContext: TaskContext,
  scores: ContextualInputs,
): ContextualOutputs {
  let { taskFit, outputQuality, control } = scores;
  const intent = taskContext.intent ?? '';
  const styleKeywords = new Set(taskContext.styleKeywords ?? []);
  const assetType = taskContext.assetType;

  // Image editing bonus/penalty
  const wantsImageEdit =
    taskContext.operation === 'edit' ||
    (intent !== '' &&
      tokenizeText(intent).some((t) =>
        [
          'combine', 'composite', 'edit', 'merge', 'modify', 'repaint',
          'replace', 'style-transfer', 'transfer',
        ].includes(t),
      ));

  if (wantsImageEdit && assetType === 'image') {
    const editSupport =
      tool.supports?.image_edit ||
      tool.supports?.style_transfer ||
      tool.supports?.multiple_reference_images;
    if (editSupport) {
      taskFit = Math.min(1.0, taskFit + 0.18);
      control = Math.min(1.0, control + 0.10);
    } else {
      taskFit *= 0.7;
    }
  }

  // Premium-cinematic bonus for video tasks with cinematic intent
  if (assetType === 'video') {
    const cinematicSignal =
      intent !== '' &&
      [...expandSynonyms(new Set(tokenizeText(intent))), ...styleKeywords]
        .some((w) =>
          [
            'cinematic', 'film', 'movie', 'trailer', 'teaser', 'dramatic',
            'epic', 'premium',
          ].includes(w),
        );

    if (cinematicSignal) {
      const premiumFeatures = [
        tool.supports?.native_audio,
        tool.supports?.multi_shot,
        tool.supports?.camera_direction,
        tool.supports?.lip_sync,
        tool.supports?.cinematic_quality,
      ];
      const matched = premiumFeatures.filter(Boolean).length;
      if (matched >= 3) {
        taskFit = Math.min(1.0, taskFit + 0.15);
        outputQuality = Math.min(1.0, outputQuality + 0.10);
      } else if (matched >= 1) {
        taskFit = Math.min(1.0, taskFit + 0.05);
      }
    }
  }

  return { taskFit, outputQuality, control };
}
