/**
 * Content Atomization & Native Multi-Platform Repurposing Engine.
 *
 * Clean-room primitive inspired by native repurposing pipelines and Cloudflare-native
 * thread splitters: atomizes one accepted affiliate video script into platform-native
 * formats for X/Twitter (auto-numbered <=280-char thread), Telegram Concierge channel,
 * and Reddit value-first discussion — eliminating identical copy-paste cross-posting.
 *
 * Layer: seed/ai (pure deterministic text transformation)
 *
 * @module seed/ai/content-atomizer
 */

import type { ScriptOutput } from './script-prompt-builders';

export interface AtomizedPlatformPack {
  readonly xThread: readonly string[];
  readonly telegramPost: string;
  readonly redditPost: string;
}

const X_MAX_POST_CHARS = 280;

export function splitIntoXThread(
  parts: readonly string[],
  maxChars: number = X_MAX_POST_CHARS,
): readonly string[] {
  const cleanParts = parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (cleanParts.length === 0) return [];
  const total = cleanParts.length;
  return cleanParts.map((text, idx) => {
    const prefix = `${idx + 1}/${total} `;
    const budget = Math.max(20, maxChars - prefix.length);
    const body = text.length > budget ? `${text.slice(0, budget - 1).trimEnd()}…` : text;
    return `${prefix}${body}`;
  });
}

export function atomizeScriptForOmnichannel(args: {
  readonly script: ScriptOutput;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
}): AtomizedPlatformPack {
  const sceneAtoms = args.script.scenes
    .map((s) => s.narration.replace(/https?:\/\/\S+/gi, '').trim())
    .filter(Boolean);

  const xThread = splitIntoXThread([
    args.script.title,
    ...sceneAtoms.slice(0, 4),
    `${args.ctaText} ${args.shortUrl} ${args.disclosureTag}`,
  ]);

  const telegramPost = [
    `**${args.script.title}**`,
    '',
    ...sceneAtoms.map((atom, i) => `${i + 1}. ${atom}`),
    '',
    `👉 ${args.ctaText}: ${args.shortUrl}`,
    args.disclosureTag,
  ].join('\n');

  const redditPost = [
    `# ${args.script.title}`,
    '',
    ...sceneAtoms.map((atom) => `- ${atom}`),
    '',
    `Resource: ${args.shortUrl} (${args.disclosureTag})`,
  ].join('\n');

  return { xThread, telegramPost, redditPost };
}
