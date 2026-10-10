/**
 * @file section-formatter.ts
 * @description Pacing calculation, duration estimation, and full script text assembly
 */

import type {
  ScriptStrategy,
  ScriptMainContent,
  ScriptContentSection,
  ScriptHook,
  ScriptIntroduction,
  ScriptConclusion,
  ScriptCTA,
} from './types';
import type { ExtractedClaim } from '../claim-extractor';

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function estimateDuration(mainContent: ScriptMainContent): string {
  const sectionSeconds = mainContent.sections.reduce(
    (total, s) => total + s.duration,
    0,
  );
  const fullSeconds = sectionSeconds + 5 + 15 + 30 + 15;
  return formatDuration(fullSeconds);
}

export function titleFromSnake(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function generateMainContent(
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

export function formatFullScript(script: {
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
