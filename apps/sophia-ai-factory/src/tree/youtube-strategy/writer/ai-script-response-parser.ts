/**
 * @file ai-script-response-parser.ts
 * @description LLM JSON response parser and normalizer for YouTube script generation
 */

import { extractClaims, type ExtractedClaim, type ClaimSource } from '../claim-extractor';
import type {
  ScriptStrategy,
  ScriptHook,
  ScriptContentSection,
  ScriptCTA,
} from './types';

export function parseJsonResponse(response: string): Record<string, unknown> {
  const text = String(response ?? '').trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    return JSON.parse(match[0]);
  }
}

export function normalizeAISections(
  sections: readonly Record<string, unknown>[],
  strategy: ScriptStrategy,
): ScriptContentSection[] {
  return sections
    .slice(0, 8)
    .map((section, index) => {
      const raw = Array.isArray(section.content)
        ? section.content
        : [section.content ?? section.summary ?? section.description];
      const content = raw
        .filter(Boolean)
        .map((line: unknown) => String(line).trim())
        .filter(Boolean);
      return {
        type: 'ai_generated',
        title: String(section.title ?? `${strategy.topic} Part ${index + 1}`).trim(),
        content,
        duration: parseInt(String(section.duration ?? '60'), 10) || 60,
      };
    })
    .filter((s) => s.title && s.content.length > 0);
}

export function normalizeAICTA(
  cta: unknown,
  strategy: ScriptStrategy,
): ScriptCTA {
  if (cta && typeof cta === 'object') {
    const o = cta as Record<string, unknown>;
    return {
      subscribe: String(o.subscribe ?? o.text ?? `Subscribe for more on ${strategy.topic}.`),
      like: String(o.like ?? 'Like this video if it helped.'),
      comment: String(o.comment ?? `Share your experience with ${strategy.topic} in the comments.`),
      nextVideo: String(o.nextVideo ?? 'Watch the next related video.'),
      duration: '15 seconds',
    };
  }
  return {
    subscribe: `Subscribe for more practical videos about ${strategy.topic}.`,
    like: 'Like this video if it helped.',
    comment: `Share your experience with ${strategy.topic} in the comments.`,
    nextVideo: 'Watch the next related video.',
    duration: '15 seconds',
  };
}

export function parseAIScriptResponse(
  response: string,
  strategy: ScriptStrategy,
): {
  title: string;
  hook: ScriptHook;
  sections: ScriptContentSection[];
  cta: ScriptCTA;
  claims: readonly ExtractedClaim[];
} | null {
  try {
    const parsed = parseJsonResponse(response);
    if (!parsed.title || !parsed.hook) return null;

    const sections = normalizeAISections((parsed.sections as Record<string, unknown>[]) ?? [], strategy);
    const hookRaw = parsed.hook as string | Record<string, unknown>;
    const hook: ScriptHook = {
      type: 'ai',
      text: String(typeof hookRaw === 'object' ? hookRaw.text : hookRaw).trim(),
      duration: '0:00-0:05',
    };
    const cta = normalizeAICTA(parsed.cta, strategy);
    const claims = extractClaims(
      (parsed.claims ?? []) as Record<string, unknown>[],
      (strategy.researchSources ?? []) as ClaimSource[],
    );

    return {
      title: String(parsed.title).slice(0, 100),
      hook,
      sections,
      cta,
      claims,
    };
  } catch {
    return null;
  }
}
