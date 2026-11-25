'use client';

/**
 * CapCut / TikTok Ready Export Helpers for Customer Pilot.
 *
 * Bridges `src/tree/subtitles/subtitle-formatter` (`segmentsToSrt`) to generate
 * scene-timed `.srt` subtitles, full voice narration text, and 1-click social
 * caption + pinned comment copy containing the active `/api/r/[code]` shortlink.
 *
 * @module components/first-value/pilot-capcut-pack-helpers
 */

import type { ScriptOutput } from '@/seed/ai/script-generator';
import {
  segmentsToSrt,
  type SubtitleSegment,
} from '@/tree/subtitles/subtitle-formatter';

export function buildNarrationTextFromScript(script: ScriptOutput, ctaText?: string): string {
  const parts = script.scenes
    .map((scene) => scene.narration.trim())
    .filter(Boolean);
  if (ctaText?.trim()) {
    parts.push(ctaText.trim());
  }
  return parts.join('. ');
}

export function buildSrtFromScript(script: ScriptOutput, ctaText?: string): string {
  let cursorSec = 0;
  const segments: SubtitleSegment[] = script.scenes.map((scene, index) => {
    const duration = Math.max(2, Math.min(30, Math.round(scene.duration_estimate || 6)));
    const seg: SubtitleSegment = {
      id: index + 1,
      start: cursorSec,
      end: cursorSec + duration,
      text: scene.narration.trim(),
    };
    cursorSec += duration;
    return seg;
  });

  if (ctaText?.trim()) {
    segments.push({
      id: segments.length + 1,
      start: cursorSec,
      end: cursorSec + 4,
      text: ctaText.trim(),
    });
  }

  return segmentsToSrt(segments);
}

export function buildCapCutPublishCopy(args: {
  readonly script: ScriptOutput;
  readonly ctaText: string;
  readonly shortUrl: string;
  readonly disclosureTag: string;
}): string {
  const hook = args.script.scenes[0]?.narration.trim() || args.script.title;
  const lines = [
    `[CAPTION]`,
    `${args.script.title}`,
    `${hook}`,
    `${args.ctaText}`,
    `${args.disclosureTag} #affiliate #review #tiktokmademebuyit`,
    ``,
    `[PINNED COMMENT / LINK]`,
    `${args.ctaText}: ${args.shortUrl} (${args.disclosureTag})`,
  ];
  return lines.join('\n');
}

export interface RepurposedShortClip {
  readonly clipIndex: 1 | 2 | 3;
  readonly label: string;
  readonly script: ScriptOutput;
}

/**
 * Splits a multi-scene (e.g. YouTube Long-Form 16:9) script into 3 distinct
 * 9:16 Short-Form clips (Hook/Problem, Core Value/Proof, Verdict/Offer) at $0 extra AI cost.
 */
export function extractThreeShortClipsFromLongScript(
  script: ScriptOutput,
): readonly RepurposedShortClip[] {
  const scenes = script.scenes;
  if (scenes.length < 3) return [];

  const chunkSize = Math.max(1, Math.floor(scenes.length / 3));
  const groups: readonly (typeof scenes)[] = [
    scenes.slice(0, chunkSize),
    scenes.slice(chunkSize, chunkSize * 2),
    scenes.slice(chunkSize * 2),
  ];
  const labels = ['Hook & Problem', 'Core Value & Proof', 'Verdict & Offer'] as const;

  return groups.map((group, idx) => {
    const clipIndex = (idx + 1) as 1 | 2 | 3;
    const normalizedScenes = group.map((scene, sIdx) => ({
      ...scene,
      scene_number: sIdx + 1,
      duration_estimate: Math.max(3, Math.min(20, Math.round(scene.duration_estimate || 8))),
    }));
    const totalDuration = normalizedScenes.reduce((sum, s) => sum + s.duration_estimate, 0);
    return {
      clipIndex,
      label: labels[idx],
      script: {
        title: `${script.title} — Short #${clipIndex} (${labels[idx]})`,
        total_duration: totalDuration,
        scenes: normalizedScenes,
      },
    };
  });
}

export function triggerTextFileDownload(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
