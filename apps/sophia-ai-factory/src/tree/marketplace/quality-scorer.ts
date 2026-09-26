/**
 * Virality & Hook Quality Scorer Algorithm
 *
 * Layer: tree (pure domain logic, deterministic algorithms, zero external I/O)
 * Dependencies: ./types
 *
 * Evaluates creator video blueprints across 4 dimensions:
 * 1. Hook Strength (0-30): Opening sentence pacing, style weighting, viral power words
 * 2. Storyboard Coherence (0-25): Scene density, visual prompt descriptive depth, vertical aspect ratio
 * 3. Script Cadence (0-25): Speaking rate (WPM), retention loop markers, Call To Action (CTA)
 * 4. Niche Fit (0-20): Template modularity variables, high-commercial niche bonus
 *
 * Decision Thresholds:
 * - Total Score >= 75 -> 'approved' (auto-approval to marketplace catalog)
 * - 40 <= Total Score < 75 -> 'pending' (routed to manual review queue)
 * - Total Score < 40 -> 'rejected' (deficits compiled into actionable feedback)
 *
 * @module tree/marketplace/quality-scorer
 */

import type {
  TemplateEvaluationInput,
  QualityScoreResult,
  QualityDimensionBreakdown,
  DimensionScore,
} from './types';

// High-commercial niche set for monetization bonus
const COMMERCIAL_NICHES = new Set([
  'saas',
  'finance',
  'ecommerce',
  'growth_hacking',
  'tech',
  'technology',
]);

// Viral power keywords with proven high CTR
const VIRAL_POWER_WORDS = [
  'secret',
  'stop',
  'mistake',
  'revealed',
  'nobody talks about',
  'warning',
  'shocking',
  'proven',
  'hack',
  'truth',
  'exposed',
  "don't",
  'avoid',
  'never',
];

// Call-to-action signals
const CTA_KEYWORDS = [
  'comment',
  'link in bio',
  'try now',
  'follow',
  'share',
  'click',
  'check out',
  'download',
  'subscribe',
  'save this',
];

// Open loop narrative transition markers
const TRANSITION_MARKERS = [
  'but',
  'however',
  'suddenly',
  'until',
  'meanwhile',
  'yet',
  'because',
  'what happens next',
  "here's why",
];

interface SceneParsed {
  visualPrompt?: string;
  voiceoverScript?: string;
  durationSeconds?: number;
}

/**
 * Parses storyboard JSON safely into structured scene objects
 */
function parseStoryboardScenes(storyboard: unknown): SceneParsed[] {
  if (Array.isArray(storyboard)) {
    return storyboard as SceneParsed[];
  }
  if (typeof storyboard === 'string' && storyboard.trim().length > 0) {
    try {
      const parsed = JSON.parse(storyboard) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as SceneParsed[];
      }
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Extracts words array from raw text
 */
function extractWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Evaluates Hook Strength (0-30 points)
 */
function evaluateHookStrength(
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

  // 1. Pacing score (0-10)
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

  // 2. Hook style multiplier (0-10)
  let styleScore = 7;
  const styleNorm = hookStyle.toLowerCase().trim();
  if (styleNorm === 'curiosity_gap' || styleNorm === 'pattern_interrupt') {
    styleScore = 10;
  } else if (styleNorm === 'bold_claim' || styleNorm === 'relatable_pain') {
    styleScore = 9;
  } else if (styleNorm === 'story_loop' || styleNorm === 'controversial_question') {
    styleScore = 8;
  } else {
    styleScore = 7;
  }

  // 3. Viral power words (0-10)
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

/**
 * Evaluates Storyboard Coherence (0-25 points)
 */
function evaluateStoryboardCoherence(
  scenes: SceneParsed[],
  aspectRatio: string,
  visualStylePrompt?: string,
): { score: DimensionScore; feedback: string[] } {
  const feedback: string[] = [];
  const sceneCount = scenes.length;

  // 1. Scene count (0-10)
  let sceneCountScore = 0;
  if (sceneCount >= 4 && sceneCount <= 8) {
    sceneCountScore = 10;
  } else if (sceneCount >= 2 && sceneCount <= 3) {
    sceneCountScore = 6;
    feedback.push('Storyboard: Increase scene count to 4-8 scenes for dynamic visual variety.');
  } else if (sceneCount >= 9 && sceneCount <= 12) {
    sceneCountScore = 7;
  } else if (sceneCount === 1) {
    sceneCountScore = 2;
    feedback.push('Single-scene video: Multi-scene storyboards have significantly higher retention.');
  } else {
    sceneCountScore = 0;
    feedback.push('Missing storyboard scenes: Please provide at least 4 structured scenes.');
  }

  // 2. Prompt detail (0-10)
  let avgPromptWords = 0;
  let promptScore = 0;
  if (sceneCount > 0) {
    const totalWords = scenes.reduce((acc, s) => {
      const text = (s.visualPrompt || visualStylePrompt || '').trim();
      return acc + extractWords(text).length;
    }, 0);
    avgPromptWords = Math.round(totalWords / sceneCount);
    if (avgPromptWords >= 15) {
      promptScore = 10;
    } else {
      promptScore = Math.min(10, Math.round((avgPromptWords / 15) * 10));
      feedback.push('Scene prompts are brief: Provide at least 15 descriptive words per scene prompt.');
    }
  } else {
    const visualWords = extractWords(visualStylePrompt || '').length;
    promptScore = visualWords >= 15 ? 5 : Math.round((visualWords / 15) * 5);
  }

  // 3. Aspect ratio check (0-5)
  let aspectScore = 1;
  const ratioNorm = aspectRatio.trim();
  if (ratioNorm === '9:16') {
    aspectScore = 5;
  } else if (ratioNorm === '16:9' || ratioNorm === '1:1') {
    aspectScore = 3;
    feedback.push('Aspect ratio: 9:16 vertical format is optimal for TikTok, Shorts, and Reels virality.');
  } else {
    aspectScore = 1;
    feedback.push('Unrecognized aspect ratio. Standard vertical 9:16 recommended.');
  }

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

/**
 * Evaluates Script Cadence & Retention (0-25 points)
 */
function evaluateScriptCadence(
  scriptTemplate: string,
  scenes: SceneParsed[],
  estimatedDurationSeconds = 30,
): { score: DimensionScore; feedback: string[] } {
  const feedback: string[] = [];
  const words = extractWords(scriptTemplate);
  const totalWords = words.length;

  // 1. Speaking rate WPM (0-10)
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

  // 2. Call To Action presence (0-10)
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

  // 3. Open loop transitions (0-5)
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

/**
 * Evaluates Niche Fit & Parameter Modularity (0-20 points)
 */
function evaluateNicheFit(
  scriptTemplate: string,
  niche = 'general',
): { score: DimensionScore; feedback: string[] } {
  const feedback: string[] = [];

  // 1. Template variable parameterization (0-10)
  // Match tokens like {{company_name}}, {{target_niche}}, {industry}, etc.
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

  // 2. High-commercial niche bonus (0-10)
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

/**
 * Evaluates template virality & production quality against all 4 dimensions.
 *
 * Throws validation error if script template is missing or blank.
 */
export function scoreTemplateQuality(input: TemplateEvaluationInput): QualityScoreResult {
  if (!input.scriptTemplate || input.scriptTemplate.trim().length === 0) {
    throw new Error('VALIDATION_ERROR: scriptTemplate must not be empty');
  }

  const hookStyle = input.hookStyle || 'curiosity_gap';
  const aspectRatio = input.aspectRatio || '9:16';
  const niche = input.niche || 'general';
  const scenes = parseStoryboardScenes(input.storyboardJson);

  const hook = evaluateHookStrength(input.scriptTemplate, hookStyle);
  const storyboard = evaluateStoryboardCoherence(scenes, aspectRatio, input.visualStylePrompt);
  const script = evaluateScriptCadence(input.scriptTemplate, scenes, input.estimatedDurationSeconds || 30);
  const nicheFit = evaluateNicheFit(input.scriptTemplate, niche);

  const totalScore = Math.max(
    0,
    Math.min(100, hook.score.score + storyboard.score.score + script.score.score + nicheFit.score.score),
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
