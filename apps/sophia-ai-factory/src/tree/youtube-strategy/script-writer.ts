/**
 * Script generation per YouTube format (tutorial/explainer/list/review/story).
 * Produces structured sections with claim extraction and duration estimation.
 * Ported from Lumen's script-writer-agent.
 */

import { extractClaims, type ExtractedClaim, type ClaimSource } from './claim-extractor';
import { getTemplate, type ScriptFormat } from './script-templates';

export interface ScriptStrategy {
  readonly topic: string;
  readonly angle: string;
  readonly contentType: string;
  readonly targetAudience: string;
  readonly keywords: readonly string[];
  readonly researchSources?: readonly ClaimSource[];
}

export interface ScriptHook {
  readonly type: string;
  readonly text: string;
  readonly duration: string;
}

export interface ScriptIntroduction {
  readonly greeting: string;
  readonly topicIntro: string;
  readonly valueProposition: string;
  readonly credibility: string;
  readonly duration: string;
}

export interface ScriptMainContent {
  readonly sections: readonly ScriptContentSection[];
  readonly totalDuration: number;
}

export interface ScriptContentSection {
  readonly type: string;
  readonly title: string;
  readonly content: readonly string[];
  readonly duration: number;
}

export interface ScriptConclusion {
  readonly recap: readonly string[];
  readonly finalThought: string;
  readonly duration: string;
}

export interface ScriptCTA {
  readonly subscribe: string;
  readonly like: string;
  readonly comment: string;
  readonly nextVideo: string;
  readonly duration: string;
}

export interface GeneratedScript {
  readonly title: string;
  readonly hook: ScriptHook;
  readonly introduction: ScriptIntroduction;
  readonly mainContent: ScriptMainContent;
  readonly conclusion: ScriptConclusion;
  readonly callToAction: ScriptCTA;
  readonly duration: string;
  readonly tone: string;
  readonly pacing: string;
  readonly keywords: readonly string[];
  readonly claims: readonly ExtractedClaim[];
  readonly fullScript: string;
}

/**
 * Generate a complete script for a content strategy using template fallback.
 */
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

/**
 * Parse an AI-generated JSON response into script fields.
 */
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
    const claims = extractClaims((parsed.claims ?? []) as Record<string, unknown>[], (strategy.researchSources ?? []) as ClaimSource[]);

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

/**
 * Estimate total duration in M:SS format from main content.
 */
export function estimateDuration(mainContent: ScriptMainContent): string {
  const sectionSeconds = mainContent.sections.reduce(
    (total, s) => total + s.duration,
    0,
  );
  const fullSeconds = sectionSeconds + 5 + 15 + 30 + 15;
  return formatDuration(fullSeconds);
}

/**
 * Format seconds into M:SS format.
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function generateTitle(strategy: ScriptStrategy): string {
  const ct = strategy.contentType;
  if (ct === 'Tutorial') return `How to ${strategy.topic}: Step-by-Step Guide`;
  if (ct === 'List') return `Top 10 ${strategy.topic} Tips You Need to Know`;
  if (ct === 'Review') return `${strategy.topic} Review: Is It Worth It?`;
  return strategy.angle || `${strategy.topic}: The Complete Guide`;
}

function generateHook(strategy: ScriptStrategy): ScriptHook {
  const hooks: ScriptHook[] = [
    { type: 'question', text: `Have you ever wondered how ${strategy.topic} actually works?`, duration: '0:00-0:05' },
    { type: 'promise', text: `In the next few minutes, you'll learn exactly how to master ${strategy.topic}.`, duration: '0:00-0:05' },
    { type: 'challenge', text: `Most people think they understand ${strategy.topic}, but they're completely wrong.`, duration: '0:00-0:05' },
  ];
  return hooks[Math.floor(Math.random() * hooks.length)];
}

function generateIntroduction(strategy: ScriptStrategy): ScriptIntroduction {
  const valueProps: Record<string, string> = {
    Tutorial: `how to implement ${strategy.topic} step by step`,
    Explainer: `what ${strategy.topic} is and why it matters`,
    List: `the most important things about ${strategy.topic}`,
    Review: `whether ${strategy.topic} is right for you`,
    Story: `the incredible journey of ${strategy.topic}`,
  };

  return {
    greeting: 'Hey everyone, welcome back to the channel!',
    topicIntro: `Today, we're diving deep into ${strategy.topic}.`,
    valueProposition: `By the end of this video, you'll understand exactly ${valueProps[strategy.contentType] ?? `everything about ${strategy.topic}`}.`,
    credibility: 'Based on the latest research and data',
    duration: '0:05-0:20',
  };
}

function generateMainContent(
  strategy: ScriptStrategy,
  structure: readonly { readonly name: string; readonly required: boolean }[],
): ScriptMainContent {
  const sections: ScriptContentSection[] = [];
  const skip = new Set(['hook', 'introduction', 'cta']);

  for (const section of structure) {
    if (!skip.has(section.name)) {
      sections.push({
        type: section.name,
        title: titleFromSnake(section.name),
        content: [`This section covers important aspects of ${strategy.topic} that you need to know.`],
        duration: 60,
      });
    }
  }

  const totalDuration = sections.reduce((t, s) => t + s.duration, 0);
  return { sections, totalDuration };
}

function generateConclusion(strategy: ScriptStrategy): ScriptConclusion {
  return {
    recap: [
      `So that's everything you need to know about ${strategy.topic}.`,
      'We covered the key points:',
      '- The fundamentals and why they matter',
      '- Practical steps to get started',
      '- Tips for long-term success',
    ],
    finalThought: `Remember, ${strategy.topic} is a journey, not a destination. Keep learning!`,
    duration: '30 seconds',
  };
}

function generateCTA(strategy: ScriptStrategy): ScriptCTA {
  return {
    subscribe: 'If you found this helpful, make sure to subscribe and hit the notification bell!',
    like: 'Give this video a thumbs up if you learned something new.',
    comment: `Let me know in the comments: What's your experience with ${strategy.topic}?`,
    nextVideo: 'Check out this related video for more insights.',
    duration: '15 seconds',
  };
}

function normalizeFormat(contentType: string): ScriptFormat {
  const allowed: ScriptFormat[] = ['tutorial', 'explainer', 'list', 'review', 'story'];
  const lower = contentType.toLowerCase() as ScriptFormat;
  return allowed.includes(lower) ? lower : 'explainer';
}

function titleFromSnake(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatFullScript(script: {
  title: string;
  hook: ScriptHook;
  introduction: ScriptIntroduction;
  mainContent: ScriptMainContent;
  conclusion: ScriptConclusion;
  callToAction: ScriptCTA;
  duration: string;
  tone: string;
  pacing: string;
  keywords: readonly string[];
  claims: readonly ExtractedClaim[];
  fullScript: string;
}): string {
  const lines: string[] = [];
  lines.push(`TITLE: ${script.title}`, '', '='.repeat(50), '');
  lines.push(`[${script.hook.duration}] HOOK`, script.hook.text, '');
  lines.push(
    `[${script.introduction.duration}] INTRODUCTION`,
    script.introduction.greeting,
    script.introduction.topicIntro,
    script.introduction.valueProposition,
    script.introduction.credibility,
    '',
  );
  lines.push('MAIN CONTENT', '-'.repeat(30), '');
  for (const section of script.mainContent.sections) {
    lines.push(`[${formatDuration(section.duration)}] ${section.title.toUpperCase()}`);
    for (const line of section.content) lines.push(line);
    lines.push('');
  }
  lines.push(`[${script.conclusion.duration}] CONCLUSION`);
  for (const line of script.conclusion.recap) lines.push(line);
  lines.push(script.conclusion.finalThought, '');
  lines.push(
    `[${script.callToAction.duration}] CALL TO ACTION`,
    script.callToAction.subscribe,
    script.callToAction.like,
    script.callToAction.comment,
    script.callToAction.nextVideo,
    '',
    '='.repeat(50),
    `TONE: ${script.tone}`,
    `PACING: ${script.pacing}`,
    `KEYWORDS: ${script.keywords.join(', ')}`,
  );
  return lines.join('\n');
}

function parseJsonResponse(response: string): Record<string, unknown> {
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

function normalizeAISections(
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

function normalizeAICTA(
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
