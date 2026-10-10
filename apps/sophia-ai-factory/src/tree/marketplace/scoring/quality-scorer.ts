/**
 * Quality Scorer Orchestrator
 *
 * Layer: tree/marketplace/scoring
 */
import type {
  TemplateEvaluationInput,
  QualityScoreResult,
  QualityDimensionBreakdown,
} from './types';
import { parseStoryboardScenes } from './types';
import { evaluateHookStrength, evaluateScriptCadence } from './text-evaluator';
import { evaluateStoryboardCoherence, evaluateNicheFit } from './visual-evaluator';
export function scoreTemplateQuality(
  input: TemplateEvaluationInput,
): QualityScoreResult {
  if (!input.scriptTemplate || input.scriptTemplate.trim().length === 0) {
    throw new Error('VALIDATION_ERROR: scriptTemplate must not be empty');
  }
  const hookStyle = input.hookStyle || 'curiosity_gap';
  const aspectRatio = input.aspectRatio || '9:16';
  const niche = input.niche || 'general';
  const scenes = parseStoryboardScenes(input.storyboardJson);
  const hook = evaluateHookStrength(input.scriptTemplate, hookStyle);
  const storyboard = evaluateStoryboardCoherence(
    scenes,
    aspectRatio,
    input.visualStylePrompt,
  );
  const script = evaluateScriptCadence(
    input.scriptTemplate,
    scenes,
    input.estimatedDurationSeconds || 30,
  );
  const nicheFit = evaluateNicheFit(input.scriptTemplate, niche);
  const totalScore = Math.max(
    0,
    Math.min(
      100,
      hook.score.score +
        storyboard.score.score +
        script.score.score +
        nicheFit.score.score,
    ),
  );
  let status: 'approved' | 'pending' | 'rejected' = 'rejected';
  if (totalScore >= 75) {
    status = 'approved';
  } else if (totalScore >= 40) {
    status = 'pending';
  } else {
    status = 'rejected';
  }
  const allFeedback = [
    ...hook.feedback,
    ...storyboard.feedback,
    ...script.feedback,
    ...nicheFit.feedback,
  ];
  const dimensions: QualityDimensionBreakdown = {
    hookStrength: hook.score,
    storyboardCoherence: storyboard.score,
    scriptCadence: script.score,
    nicheFit: nicheFit.score,
  };
  return {
    totalScore,
    status,
    dimensions,
    feedback: allFeedback,
  };
}
