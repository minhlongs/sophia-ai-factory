/**
 * Timeline-Isolated SRT / WebVTT Localization Utility.
 *
 * Clean-room primitive (MIT pattern from rockbenben/subtitle-translator):
 * strips cue numbers, timecodes, and WebVTT NOTE/STYLE/REGION blocks locally
 * so only dialogue text is sent to the customer's BYOK LLM, then re-assembles
 * the translated lines with 0% timeline corruption across 120+ languages.
 *
 * Layer: seed/video (pure string parser/reassembler, zero external deps)
 *
 * @module seed/video/timeline-isolated-srt
 */

export interface IsolatedSubtitlePayload {
  readonly rawLines: readonly string[];
  readonly contentIndices: readonly number[];
  readonly contentLines: readonly string[];
}

const TIMECODE_LINE = /^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/;
const CUE_INDEX_LINE = /^\d+$/;
const VTT_HEADER_LINE = /^(?:WEBVTT|NOTE|STYLE|REGION)\b/i;

export function extractSubtitleDialogueLines(rawSubtitle: string): IsolatedSubtitlePayload {
  const rawLines = rawSubtitle.replace(/\r\n/g, '\n').split('\n');
  const contentIndices: number[] = [];
  const contentLines: string[] = [];
  let inVttMetaBlock = false;

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (!trimmed) {
      inVttMetaBlock = false;
      continue;
    }
    if (VTT_HEADER_LINE.test(trimmed)) {
      inVttMetaBlock = !trimmed.startsWith('WEBVTT');
      continue;
    }
    if (inVttMetaBlock || CUE_INDEX_LINE.test(trimmed) || TIMECODE_LINE.test(trimmed)) {
      continue;
    }
    contentIndices.push(i);
    contentLines.push(rawLines[i]);
  }

  return { rawLines, contentIndices, contentLines };
}

export function reassembleLocalizedSubtitle(
  isolated: IsolatedSubtitlePayload,
  translatedLines: readonly string[],
): string {
  const out = [...isolated.rawLines];
  for (let i = 0; i < isolated.contentIndices.length; i++) {
    const lineIdx = isolated.contentIndices[i];
    if (translatedLines[i] !== undefined) {
      out[lineIdx] = translatedLines[i];
    }
  }
  return out.join('\n');
}
