/**
 * Frame-Pure WebCodecs Browser Video Timeline & Karaoke Caption Spec.
 *
 * Clean-room primitive inspired by deterministic frame-pure browser renderers
 * (WebMotion / Contents-Maker): every frame at `frameIndex` is a pure function
 * of time, enabling repeatable seeking, smooth Ken Burns zoom interpolation,
 * word-level karaoke caption highlights, and zero-COGS client-side rendering
 * with automatic fallback to the pure-JS H.264 encoder when WebCodecs is absent.
 *
 * Layer: seed/video (pure deterministic math, zero DOM/server deps)
 *
 * @module seed/video/webcodecs-timeline-spec
 */

export interface TimelineSceneInput {
  readonly sceneNumber: number;
  readonly narration: string;
  readonly durationSec: number;
}

export interface KaraokeWordCue {
  readonly word: string;
  readonly startSec: number;
  readonly endSec: number;
  readonly sceneNumber: number;
}

export interface TimelineFrameState {
  readonly frameIndex: number;
  readonly timestampSec: number;
  readonly sceneNumber: number;
  readonly sceneProgress: number;
  readonly kenBurnsScale: number;
  readonly activeWordIndex: number;
  readonly activeWord: string | null;
  readonly captionWindow: readonly KaraokeWordCue[];
}

export interface WebCodecsCapability {
  readonly hasVideoEncoder: boolean;
  readonly hasAudioEncoder: boolean;
  readonly hasOffscreenCanvas: boolean;
  readonly recommendedBackend: 'webcodecs_audio_muxed' | 'pure_js_h264_fallback';
}

const DEFAULT_FPS = 30;
const KEN_BURNS_MAX_ZOOM = 0.08;
const CAPTION_WINDOW_WORDS = 5;

/**
 * Generates deterministic word-level karaoke timing cues from scene narrations.
 */
export function buildKaraokeWordCues(
  scenes: readonly TimelineSceneInput[],
): readonly KaraokeWordCue[] {
  const cues: KaraokeWordCue[] = [];
  let cursorSec = 0;

  for (const scene of scenes) {
    const safeDuration = Math.max(0.5, scene.durationSec);
    const words = scene.narration
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words.length > 0) {
      const stepSec = safeDuration / words.length;
      for (let i = 0; i < words.length; i++) {
        cues.push({
          word: words[i],
          startSec: Number((cursorSec + i * stepSec).toFixed(3)),
          endSec: Number((cursorSec + (i + 1) * stepSec).toFixed(3)),
          sceneNumber: scene.sceneNumber,
        });
      }
    }
    cursorSec += safeDuration;
  }

  return cues;
}

/**
 * Pure frame evaluator: maps `frameIndex` to exact scene progress,
 * Ken Burns zoom scale (1.00 -> 1.08), and active karaoke word window.
 */
export function evaluateFrameStateAtIndex(
  scenes: readonly TimelineSceneInput[],
  cues: readonly KaraokeWordCue[],
  frameIndex: number,
  fps: number = DEFAULT_FPS,
): TimelineFrameState {
  const safeFps = Math.max(1, fps);
  const safeFrame = Math.max(0, Math.floor(frameIndex));
  const timestampSec = safeFrame / safeFps;

  let sceneStart = 0;
  let activeScene = scenes[0] ?? { sceneNumber: 1, narration: '', durationSec: 1 };
  let sceneProgress = 0;

  for (const scene of scenes) {
    const dur = Math.max(0.5, scene.durationSec);
    if (timestampSec <= sceneStart + dur || scene === scenes[scenes.length - 1]) {
      activeScene = scene;
      sceneProgress = Math.min(1, Math.max(0, (timestampSec - sceneStart) / dur));
      break;
    }
    sceneStart += dur;
  }

  const activeWordIndex = cues.findIndex(
    (c) => timestampSec >= c.startSec && timestampSec < c.endSec,
  );
  const resolvedWordIdx =
    activeWordIndex === -1 && cues.length > 0 && timestampSec >= cues[cues.length - 1].endSec
      ? cues.length - 1
      : activeWordIndex;

  const pageStart =
    resolvedWordIdx >= 0
      ? Math.floor(resolvedWordIdx / CAPTION_WINDOW_WORDS) * CAPTION_WINDOW_WORDS
      : 0;
  const captionWindow = cues.slice(pageStart, pageStart + CAPTION_WINDOW_WORDS);

  return {
    frameIndex: safeFrame,
    timestampSec: Number(timestampSec.toFixed(3)),
    sceneNumber: activeScene.sceneNumber,
    sceneProgress: Number(sceneProgress.toFixed(4)),
    kenBurnsScale: Number((1 + sceneProgress * KEN_BURNS_MAX_ZOOM).toFixed(4)),
    activeWordIndex: resolvedWordIdx,
    activeWord: resolvedWordIdx >= 0 ? cues[resolvedWordIdx].word : null,
    captionWindow,
  };
}

/**
 * Feature-detects browser WebCodecs support without requiring COOP/COEP headers
 * or third-party license telemetry.
 */
export function detectWebCodecsBrowserSupport(
  scope: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
): WebCodecsCapability {
  const hasVideoEncoder = typeof scope.VideoEncoder === 'function';
  const hasAudioEncoder = typeof scope.AudioEncoder === 'function';
  const hasOffscreenCanvas = typeof scope.OffscreenCanvas === 'function';
  return {
    hasVideoEncoder,
    hasAudioEncoder,
    hasOffscreenCanvas,
    recommendedBackend:
      hasVideoEncoder && hasAudioEncoder ? 'webcodecs_audio_muxed' : 'pure_js_h264_fallback',
  };
}
