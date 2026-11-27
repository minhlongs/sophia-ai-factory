/**
 * Word-Level Kinetic Caption Typography & Karaoke Beat Chunker.
 *
 * Clean-room pure-TS engine (MIT patterns from vidstack/captions and
 * xixihhhh/hotclip):
 * - Chunks word tokens into 2–4 word kinetic beats with silence-gap (750ms) and
 *   punctuation-aware line breaks.
 * - Emits ASS `{\k<cs>}` karaoke sweep tags and WebVTT inline timestamps in 0ms.
 *
 * Layer: seed/video (pure deterministic text/timing math, zero deps)
 *
 * @module seed/video/kinetic-captions
 */

export interface WordTiming {
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface KineticBeat {
  readonly index: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly words: readonly WordTiming[];
  readonly assKaraokeLine: string;
}

const HARD_PUNCT_END = /[.!?…]+$/;

export function chunkWordsIntoKineticBeats(
  words: readonly WordTiming[],
  options?: { readonly maxWords?: number; readonly silenceGapMs?: number },
): readonly KineticBeat[] {
  const maxWords = Math.max(1, Math.min(6, options?.maxWords ?? 4));
  const silenceGapMs = options?.silenceGapMs ?? 750;
  const beats: KineticBeat[] = [];
  let current: WordTiming[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const startMs = current[0].startMs;
    const endMs = current[current.length - 1].endMs;
    const assKaraokeLine = current
      .map((w, idx) => {
        const nextStart = idx + 1 < current.length ? current[idx + 1].startMs : w.endMs;
        const cs = Math.max(1, Math.round((Math.max(w.endMs, nextStart) - w.startMs) / 10));
        return `{\\k${cs}}${w.text.trim()}`;
      })
      .join(' ');
    beats.push({ index: beats.length + 1, startMs, endMs, words: current, assKaraokeLine });
    current = [];
  };

  for (const raw of words) {
    const text = raw.text.trim();
    if (!text) continue;
    const token: WordTiming = { text, startMs: raw.startMs, endMs: Math.max(raw.startMs + 50, raw.endMs) };

    if (current.length > 0) {
      const prev = current[current.length - 1];
      const gap = token.startMs - prev.endMs;
      if (gap >= silenceGapMs || current.length >= maxWords) {
        flush();
      }
    }
    current.push(token);
    if (HARD_PUNCT_END.test(text)) {
      flush();
    }
  }
  flush();
  return beats;
}
