/**
 * Shared Audio-Driven Timeline for Narrated Vietnamese Video (Wave C.4.1 G7).
 *
 * Ensures scene visuals, narration segments, caption cues, CTA end-card,
 * and total video duration are driven by actual measured decoded audio durations —
 * never silently truncating speech or omitting approved script text.
 *
 * @module seed/video/audio-driven-timeline
 */

export interface AudioTimelineSceneInput {
  readonly sceneId: string;
  readonly sceneNumber: number;
  readonly narration: string;
  readonly measuredAudioDurationSec: number;
}

export interface AudioTimelineSegment {
  readonly sceneId: string;
  readonly sceneNumber: number;
  readonly narration: string;
  readonly startSec: number;
  readonly endSec: number;
  readonly durationSec: number;
  readonly audioDurationSec: number;
}

export interface SharedAudioDrivenTimeline {
  readonly scenes: readonly AudioTimelineSegment[];
  readonly ctaStartSec: number;
  readonly ctaEndSec: number;
  readonly ctaDurationSec: number;
  readonly totalDurationSec: number;
  readonly targetMinSec: number;
  readonly targetMaxSec: number;
  readonly withinTargetWindow: boolean;
  readonly advisory: string | null;
}

export function buildSharedAudioDrivenTimeline(input: {
  readonly scenes: readonly AudioTimelineSceneInput[];
  readonly ctaDurationSec?: number;
  readonly targetMinSec?: number;
  readonly targetMaxSec?: number;
}): SharedAudioDrivenTimeline {
  if (input.scenes.length === 0) {
    throw new Error('Shared audio timeline requires at least one scene');
  }

  const targetMinSec = input.targetMinSec ?? 30;
  const targetMaxSec = input.targetMaxSec ?? 45;
  const ctaDurationSec = Math.max(0, input.ctaDurationSec ?? 3);

  let cursorSec = 0;
  const segments: AudioTimelineSegment[] = input.scenes.map((scene) => {
    const audioDur = scene.measuredAudioDurationSec;
    if (!Number.isFinite(audioDur) || audioDur <= 0) {
      throw new Error(`Invalid measured audio duration for scene ${scene.sceneId}: ${audioDur}`);
    }
    const startSec = Math.round(cursorSec * 1000) / 1000;
    const durationSec = Math.round(audioDur * 1000) / 1000;
    const endSec = Math.round((startSec + durationSec) * 1000) / 1000;
    cursorSec = endSec;
    return {
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      narration: scene.narration,
      startSec,
      endSec,
      durationSec,
      audioDurationSec: durationSec,
    };
  });

  const ctaStartSec = Math.round(cursorSec * 1000) / 1000;
  const ctaEndSec = Math.round((ctaStartSec + ctaDurationSec) * 1000) / 1000;
  const totalDurationSec = ctaEndSec;
  const withinTargetWindow = totalDurationSec >= targetMinSec && totalDurationSec <= targetMaxSec;

  const advisory = withinTargetWindow
    ? null
    : totalDurationSec > targetMaxSec
      ? `Actual narration + CTA duration (${totalDurationSec}s) exceeds ${targetMaxSec}s target; scene timing expanded without truncating speech.`
      : `Actual narration + CTA duration (${totalDurationSec}s) is shorter than ${targetMinSec}s target.`;

  return {
    scenes: segments,
    ctaStartSec,
    ctaEndSec,
    ctaDurationSec,
    totalDurationSec,
    targetMinSec,
    targetMaxSec,
    withinTargetWindow,
    advisory,
  };
}
