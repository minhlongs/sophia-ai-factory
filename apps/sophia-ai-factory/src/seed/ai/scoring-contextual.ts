/**
 * Contextual scoring adjustments for provider scoring engine.
 *
 * Applies task-specific adjustments to base dimension scores:
 * motion-required penalty, stock-like provider penalty, reference conditioning,
 * image editing bonus, and premium-cinematic bonus.
 *
 * @module seed/ai/scoring-contextual
 */

import { tokenizeText, expandSynonyms } from './scoring-helpers';
import type { TaskContext, ToolInfo } from './provider-scoring-types';

export interface ContextualInputs {
  taskFit: number;
  outputQuality: number;
  control: number;
}

/** Adjusted scores have the same shape as the inputs. */
export type ContextualOutputs = ContextualInputs;

/**
 * Apply contextual adjustments to base scores.
 *
 * Modifies taskFit, outputQuality, and control based on task context.
 * All adjustments are additive or multiplicative, capped at 1.0.
 */
export function applyContextualAdjustments(
  tool: ToolInfo,
  taskContext: TaskContext,
  inputs: ContextualInputs,
): ContextualOutputs {
  let { taskFit, outputQuality, control } = inputs;
  const intent = taskContext.intent ?? '';
  const styleKeywords = new Set(taskContext.styleKeywords ?? []);
  const assetType = taskContext.assetType;

  // Motion-required penalty: if task needs motion but tool is image-only
  if (
    taskContext.motionRequired &&
    assetType === 'video' &&
    !(tool.capability ?? '').includes('video')
  ) {
    taskFit *= 0.2; // Heavy penalty
  }

  // Stock-like provider penalty for generated-visual preferences
  const isStockLike = ['pexels', 'pixabay'].includes(
    tool.provider.toLowerCase(),
  );

  if (
    intent !== '' &&
    isStockLike &&
    (assetType === 'video' || assetType === 'image')
  ) {
    const generatedVisualTerms = new Set([
      'animated', 'animation', 'anime', 'cartoon', 'character',
      'cinematic', 'concept', 'fantasy', 'ghibli', 'illustration',
      'pixar', 'render', 'scifi', 'short', 'story', 'stylized', 'surreal',
    ]);
    const intentTokens = new Set(tokenizeText(intent));
    const hasGeneratedVisual = [...intentTokens].some((t) =>
      generatedVisualTerms.has(t),
    );
    if (hasGeneratedVisual) {
      taskFit *= 0.55;
      outputQuality *= 0.85;
    }
  }

  // Reference conditioning bonus/penalty
  const wantsReference =
    taskContext.operation === 'reference_to_video' ||
    (intent !== '' &&
      tokenizeText(intent).some((t) =>
        ['character', 'consistency', 'identity', 'preserve', 'product',
         'reference', 'subject', 'wardrobe'].includes(t),
      ));

  if (wantsReference && assetType === 'video') {
    const refSupport =
      tool.supports?.reference_to_video ||
      tool.supports?.reference_image ||
      tool.supports?.multiple_reference_images;
    if (refSupport) {
      taskFit = Math.min(1.0, taskFit + 0.18);
      control = Math.min(1.0, control + 0.12);
    } else {
      taskFit *= 0.7;
    }
  }

  // Image editing bonus/penalty
  const wantsImageEdit =
    taskContext.operation === 'edit' ||
    (intent !== '' &&
      tokenizeText(intent).some((t) =>
        ['combine', 'composite', 'edit', 'merge', 'modify', 'repaint',
         'replace', 'style-transfer', 'transfer'].includes(t),
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
          ['cinematic', 'film', 'movie', 'trailer', 'teaser', 'dramatic',
           'epic', 'premium'].includes(w),
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
