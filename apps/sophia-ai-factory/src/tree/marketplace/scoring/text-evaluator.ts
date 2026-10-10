/**
 * Text Evaluator (Hook Strength & Script Cadence)
 *
 * Layer: tree/marketplace/scoring
 */
import type { DimensionScore, SceneParsed } from './types';
import {
  CTA_KEYWORDS,
  TRANSITION_MARKERS,
  VIRAL_POWER_WORDS,
  extractWords,
} from './types';
export function evaluateHookStrength(
  scriptTemplate: string,
  hookStyle: string,
): { score: DimensionScore; feedback: string[] } {
  const feedback: string[] = [];
  const sentences = scriptTemplate
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const openingSentence = sentences[0] || '';
  const openingWords = extractWords(openingSentence);
  const openingWordCount = openingWords.length;
  let pacingScore = 0;
  if (openingWordCount >= 5 && openingWordCount <= 12) {
    pacingScore = 10;
  } else if (openingWordCount >= 3 && openingWordCount <= 16) {
    pacingScore = 7;
    feedback.push('Hook pacing: Aim for 5-12 punchy words in your opening sentence.');
  } else if (openingWordCount > 16) {
    pacingScore = 4;
    feedback.push('Hook is too long: Shorten the first sentence to under 12 words for higher retention.');
  } else {
    pacingScore = 2;
    feedback.push('Hook is too brief: Provide enough context in your first sentence to spark curiosity.');
  }
  let styleScore = 7;
  const styleNorm = hookStyle.toLowerCase().trim();
  if (styleNorm === 'curiosity_gap' || styleNorm === 'pattern_interrupt') {
    styleScore = 10;
  } else if (styleNorm === 'bold_claim' || styleNorm === 'relatable_pain') {
    styleScore = 9;
  } else if (styleNorm === 'story_loop' || styleNorm === 'controversial_question') {
    styleScore = 8;
  }
  const lowerScript = scriptTemplate.toLowerCase();
  const matchedViralWords: string[] = [];
  for (const word of VIRAL_POWER_WORDS) {
    if (lowerScript.includes(word)) {
      matchedViralWords.push(word);
    }
  }
  const viralScore = Math.min(10, matchedViralWords.length * 2.5);
  if (matchedViralWords.length === 0) {
    feedback.push('Add high-CTR power words (e.g., secret, mistake, revealed, stop, proven).');
  }
  const total = Math.min(30, Math.round(pacingScore + styleScore + viralScore));
  return {
    score: {
      score: total,
      maxScore: 30,
      details: {
        openingWordCount,
        pacingScore,
        hookStyle: styleNorm,
        styleScore,
        viralWordsMatched: matchedViralWords.length,
        viralScore,
      },
    },
    feedback,
  };
}
export function evaluateScriptCadence(
  scriptTemplate: string,
  scenes: SceneParsed[],
  estimatedDurationSeconds = 30,
): { score: DimensionScore; feedback: string[] } {
  const feedback: string[] = [];
  const words = extractWords(scriptTemplate);
  const totalWords = words.length;
  const durationMinutes = Math.max(0.1, estimatedDurationSeconds / 60);
  const wpm = Math.round(totalWords / durationMinutes);
  let wpmScore = 4;
  if (wpm >= 130 && wpm <= 165) {
    wpmScore = 10;
  } else if ((wpm >= 110 && wpm < 130) || (wpm > 165 && wpm <= 185)) {
    wpmScore = 7;
    feedback.push(`Speaking rate is ${wpm} WPM. Optimal target is 130-165 WPM.`);
  } else {
    wpmScore = 4;
    feedback.push(`Speaking rate of ${wpm} WPM is outside optimal cadence (130-165 WPM).`);
  }
  const lowerScript = scriptTemplate.toLowerCase();
  const lastSceneScript = scenes.length > 0
    ? (scenes[scenes.length - 1].voiceoverScript || '').toLowerCase()
    : '';
  const matchedCta = CTA_KEYWORDS.some(
    (cta) => lowerScript.includes(cta) || lastSceneScript.includes(cta),
  );
  const ctaScore = matchedCta ? 10 : 0;
  if (!matchedCta) {
    feedback.push('Missing Call-To-Action (CTA): Add an explicit closing prompt (e.g., "link in bio", "comment below").');
  }
  const matchedTransitions = TRANSITION_MARKERS.filter((m) => lowerScript.includes(m));
  const transitionScore = Math.min(5, matchedTransitions.length * 2.5);
  if (matchedTransitions.length === 0) {
    feedback.push('Add open loop transitions ("but", "however", "here\'s why") to sustain mid-video retention.');
  }
  const total = Math.min(25, Math.round(wpmScore + ctaScore + transitionScore));
  return {
    score: {
      score: total,
      maxScore: 25,
      details: {
        totalWords,
        estimatedDurationSeconds,
        wpm,
        wpmScore,
        matchedCta,
        ctaScore,
        transitionCount: matchedTransitions.length,
        transitionScore,
      },
    },
    feedback,
  };
}
