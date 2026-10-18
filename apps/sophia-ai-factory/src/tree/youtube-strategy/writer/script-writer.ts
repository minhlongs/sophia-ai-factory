/**
 * @file script-writer.ts
 * @description Script synthesis engine and LLM prompt response parser
 */

import { extractClaims, type ClaimSource } from '../claim-extractor';
import { getTemplate } from '../script-templates';
import type {
  ScriptStrategy,
  GeneratedScript,
} from './types';
import {
  generateTitle,
  generateHook,
  generateIntroduction,
  generateConclusion,
  generateCTA,
  normalizeFormat,
} from './hook-generator';
import {
  estimateDuration,
  generateMainContent,
  formatFullScript,
} from './section-formatter';

export {
  parseJsonResponse,
  normalizeAISections,
  normalizeAICTA,
  parseAIScriptResponse,
} from './ai-script-response-parser';

export function generateScript(strategy: ScriptStrategy): GeneratedScript {
  const format = normalizeFormat(strategy.contentType);
  const template = getTemplate(format);

  const hook = generateHook(strategy);
  const introduction = generateIntroduction(strategy);
  const mainContent = generateMainContent(strategy, template.structure);
  const conclusion = generateConclusion(strategy);
  const callToAction = generateCTA(strategy);

  const claims = extractClaims([], (strategy.researchSources ?? []) as ClaimSource[]);

  const fullScript = formatFullScript({
    title: generateTitle(strategy),
    hook,
    introduction,
    mainContent,
    conclusion,
    callToAction,
    duration: '',
    tone: template.tone,
    pacing: template.pacing,
    keywords: strategy.keywords,
    claims,
    fullScript: '',
  });

  const duration = estimateDuration(mainContent);

  return {
    title: generateTitle(strategy),
    hook,
    introduction,
    mainContent,
    conclusion,
    callToAction,
    duration,
    tone: template.tone,
    pacing: template.pacing,
    keywords: strategy.keywords,
    claims,
    fullScript,
  };
}
