/**
 * Visual & Niche Evaluator (Storyboard Coherence & Niche Fit)
 *
 * Layer: tree/marketplace/scoring
 */
import type { DimensionScore, SceneParsed } from './types';
import { COMMERCIAL_NICHES, extractWords } from './types';
function scoreSceneCount(sceneCount: number, feedback: string[]): number {
  if (sceneCount >= 4 && sceneCount <= 8) return 10;
  if (sceneCount >= 2 && sceneCount <= 3) {
    feedback.push('Storyboard: Increase scene count to 4-8 scenes for dynamic visual variety.');
    return 6;
  }
  if (sceneCount >= 9 && sceneCount <= 12) return 7;
  if (sceneCount === 1) {
    feedback.push('Single-scene video: Multi-scene storyboards have significantly higher retention.');
    return 2;
  }
  feedback.push('Missing storyboard scenes: Please provide at least 4 structured scenes.');
  return 0;
}
function scorePromptDetail(
  scenes: SceneParsed[],
  visualStylePrompt: string | undefined,
  feedback: string[],
): { avgPromptWords: number; promptScore: number } {
  const sceneCount = scenes.length;
  if (sceneCount > 0) {
    const totalWords = scenes.reduce((acc, s) => {
      const text = (s.visualPrompt || visualStylePrompt || '').trim();
      return acc + extractWords(text).length;
    }, 0);
    const avgPromptWords = Math.round(totalWords / sceneCount);
    if (avgPromptWords >= 15) {
      return { avgPromptWords, promptScore: 10 };
    }
    feedback.push('Scene prompts are brief: Provide at least 15 descriptive words per scene prompt.');
    return { avgPromptWords, promptScore: Math.min(10, Math.round((avgPromptWords / 15) * 10)) };
  }
  const visualWords = extractWords(visualStylePrompt || '').length;
  const promptScore = visualWords >= 15 ? 5 : Math.round((visualWords / 15) * 5);
  return { avgPromptWords: 0, promptScore };
}
function scoreAspectRatio(
  aspectRatio: string,
  feedback: string[],
): { ratioNorm: string; aspectScore: number } {
  const ratioNorm = aspectRatio.trim();
  if (ratioNorm === '9:16') {
    return { ratioNorm, aspectScore: 5 };
  }
  if (ratioNorm === '16:9' || ratioNorm === '1:1') {
    feedback.push('Aspect ratio: 9:16 vertical format is optimal for TikTok, Shorts, and Reels virality.');
    return { ratioNorm, aspectScore: 3 };
  }
  feedback.push('Unrecognized aspect ratio. Standard vertical 9:16 recommended.');
  return { ratioNorm, aspectScore: 1 };
}
export function evaluateStoryboardCoherence(
  scenes: SceneParsed[],
  aspectRatio: string,
  visualStylePrompt?: string,
): { score: DimensionScore; feedback: string[] } {
  const feedback: string[] = [];
  const sceneCount = scenes.length;
  const sceneCountScore = scoreSceneCount(sceneCount, feedback);
  const { avgPromptWords, promptScore } = scorePromptDetail(scenes, visualStylePrompt, feedback);
  const { ratioNorm, aspectScore } = scoreAspectRatio(aspectRatio, feedback);
  const total = Math.min(25, Math.round(sceneCountScore + promptScore + aspectScore));
  return {
    score: {
      score: total,
      maxScore: 25,
      details: {
        sceneCount,
        sceneCountScore,
        avgPromptWords,
        promptScore,
        aspectRatio: ratioNorm,
        aspectScore,
      },
    },
    feedback,
  };
}
export function evaluateNicheFit(
  scriptTemplate: string,
  niche = 'general',
): { score: DimensionScore; feedback: string[] } {
  const feedback: string[] = [];
  const tokenMatches = scriptTemplate.match(/\{\{[^}]+\}\}|\{[a-zA-Z0-9_]+\}/g) || [];
  const uniqueTokens = new Set(tokenMatches);
  let tokenScore = 0;
  if (uniqueTokens.size >= 2) {
    tokenScore = 10;
  } else if (uniqueTokens.size === 1) {
    tokenScore = 5;
    feedback.push('Increase modularity: Add at least 2 template variables (e.g. {{company_name}}, {{product}}).');
  } else {
    tokenScore = 0;
    feedback.push('No customizable template variables found. Use {{variable_name}} so remixers can personalize it.');
  }
  const nicheNorm = niche.toLowerCase().trim();
  const isCommercial = COMMERCIAL_NICHES.has(nicheNorm);
  const nicheScore = isCommercial ? 10 : 5;
  const total = Math.min(20, Math.round(tokenScore + nicheScore));
  return {
    score: {
      score: total,
      maxScore: 20,
      details: {
        uniqueTokensCount: uniqueTokens.size,
        tokenScore,
        niche: nicheNorm,
        isCommercial,
        nicheScore,
      },
    },
    feedback,
  };
}
