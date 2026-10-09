/**
 * Script Parsing Helper for Multi-Track Orchestration.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/script-parser
 */

import type { ScriptScene } from '@/tree/mission';

/**
 * Robust script parser extracting visual prompts and voiceover narration.
 */
export function parseScriptIntoScenes(
  rawContent: string,
  topic: string,
  expectedScenes = 3
): {
  title: string;
  fullNarration: string;
  scenes: ScriptScene[];
  estimatedDurationSec: number;
  wordCount: number;
} {
  const content = rawContent.trim();

  // Try JSON parse if structured response
  if (content.startsWith('{') && content.endsWith('}')) {
    try {
      const parsed = JSON.parse(content) as {
        title?: string;
        narration?: string;
        scenes?: Array<{ index?: number; prompt?: string; narration?: string; duration?: number }>;
      };
      if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
        const scenes: ScriptScene[] = parsed.scenes.map((s, idx) => ({
          index: s.index ?? idx + 1,
          prompt: s.prompt || `${topic} scene ${idx + 1}`,
          narration: s.narration,
          durationSeconds: s.duration,
        }));
        const fullNarration =
          parsed.narration ||
          scenes
            .map((s) => s.narration)
            .filter(Boolean)
            .join(' ') ||
          content;
        const wordCount = fullNarration.split(/\s+/).filter(Boolean).length;
        return {
          title: parsed.title || topic,
          fullNarration,
          scenes,
          estimatedDurationSec: Math.max(15, Math.round(wordCount / 2.5)),
          wordCount,
        };
      }
    } catch {
      // Fall through to text pattern extraction
    }
  }

  // Text extraction with scene markers
  const sceneBlocks = content.split(/Scene\s*(\d+):?/i).filter(Boolean);
  const scenes: ScriptScene[] = [];
  let fullNarration = '';

  if (sceneBlocks.length >= 2) {
    for (let i = 0; i < sceneBlocks.length; i += 2) {
      const sceneIdx = parseInt(sceneBlocks[i], 10) || scenes.length + 1;
      const text = (sceneBlocks[i + 1] || '').trim();
      const visualMatch = text.match(/Visual:?\s*([^\n]+)/i);
      const narrationMatch = text.match(/Narration:?\s*([^\n]+)/i);

      const prompt = visualMatch ? visualMatch[1].trim() : text.slice(0, 150) || `${topic} scene ${sceneIdx}`;
      const narration = narrationMatch ? narrationMatch[1].trim() : text;

      scenes.push({
        index: sceneIdx,
        prompt,
        narration,
      });
      fullNarration += (narration ? narration + ' ' : '');
    }
  }

  // Fallback if no scene markers found: split into paragraphs
  if (scenes.length === 0) {
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const count = Math.max(expectedScenes, paragraphs.length || 1);
    for (let i = 0; i < count; i++) {
      const pText = paragraphs[i] || `${topic} scene ${i + 1}`;
      scenes.push({
        index: i + 1,
        prompt: `${topic} - scene ${i + 1}: ${pText.slice(0, 100)}`,
        narration: pText,
      });
    }
    fullNarration = content;
  }

  const wordCount = fullNarration.split(/\s+/).filter(Boolean).length;
  const estimatedDurationSec = Math.max(15, Math.round(wordCount / 2.5));

  return {
    title: topic,
    fullNarration: fullNarration.trim(),
    scenes,
    estimatedDurationSec,
    wordCount,
  };
}
