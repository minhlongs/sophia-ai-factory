/**
 * Zero-cost DOM Browser Preview & Inline Caption/Headline Editor for Sophia Video Timelines.
 * @module components/video/timeline-browser-preview
 */

'use client';

import React, { useState } from 'react';
import { Film, Play, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  getTimelineMetrics,
  type SophiaVideoTimeline,
  type VideoCaptionCue,
  type VideoTimelineScene,
} from '@/seed/types/video-timeline-schema';
import type { VideoRendererEngine } from '@/tree/video/render/video-renderer-port';

export interface TimelineBrowserPreviewProps {
  initialTimeline: SophiaVideoTimeline;
  defaultEngine?: VideoRendererEngine;
  onTriggerRender?: (timeline: SophiaVideoTimeline, engine: VideoRendererEngine) => void;
}

export function TimelineBrowserPreview({
  initialTimeline,
  defaultEngine = 'hyperframes',
  onTriggerRender,
}: TimelineBrowserPreviewProps): React.ReactElement {
  const [timeline, setTimeline] = useState<SophiaVideoTimeline>(initialTimeline);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [engine, setEngine] = useState<VideoRendererEngine>(defaultEngine);

  const activeScene: VideoTimelineScene | undefined =
    timeline.scenes[selectedSceneIndex] ?? timeline.scenes[0];
  const metrics = getTimelineMetrics(timeline);

  const updateSceneHeadline = (sceneId: string, nextHeadline: string) => {
    setTimeline((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.sceneId === sceneId ? { ...s, headline: nextHeadline } : s)),
    }));
  };

  const updateCaptionText = (captionId: string, nextText: string) => {
    setTimeline((prev) => ({
      ...prev,
      captions: prev.captions.map((c: VideoCaptionCue) =>
        c.id === captionId ? { ...c, text: nextText } : c,
      ),
    }));
  };

  const sceneStartSec = activeScene ? activeScene.startFrame / timeline.fps : 0;
  const sceneEndSec = activeScene ? (activeScene.startFrame + activeScene.durationInFrames) / timeline.fps : 0;
  const visibleCaptions = timeline.captions.filter((c) => c.endSec > sceneStartSec && c.startSec < sceneEndSec);

  return (
    <section data-testid="timeline-browser-preview" className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-amber-500" />
          <div>
            <h3 className="text-base font-semibold text-foreground">{timeline.title}</h3>
            <p className="text-xs text-muted-foreground">
              {timeline.width}x{timeline.height} • {timeline.fps}fps • {metrics.durationSec}s ({metrics.totalFrames} frames)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="video-renderer-engine-select" className="text-xs text-muted-foreground">Engine:</label>
          <select
            id="video-renderer-engine-select"
            data-testid="video-renderer-engine-select"
            value={engine}
            onChange={(e) => setEngine(e.target.value as VideoRendererEngine)}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground"
          >
            <option value="hyperframes">HyperFrames (Apache-2.0)</option>
            <option value="remotion">Remotion (Free Tier)</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div
          data-testid="timeline-dom-stage"
          style={{ backgroundColor: activeScene?.backgroundHex ?? 'var(--studio-stage-bg)' }}
          className="relative flex aspect-[9/16] max-h-[380px] flex-col justify-between overflow-hidden rounded-xl border border-amber-500/30 p-4 text-white shadow-inner"
        >
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-300">
            <span>{activeScene?.kind ?? 'SCENE'}</span>
            <span>{sceneStartSec.toFixed(1)}s – {sceneEndSec.toFixed(1)}s</span>
          </div>
          <div className="my-auto space-y-2 text-center">
            <p data-testid="preview-active-headline" className="text-lg font-bold leading-snug text-white">
              {activeScene?.headline}
            </p>
            {activeScene?.subheadline && <p className="text-xs text-slate-300">{activeScene.subheadline}</p>}
          </div>
          <div className="space-y-1">
            {visibleCaptions.map((cue) => (
              <div
                key={cue.id}
                data-testid={`preview-caption-${cue.id}`}
                className="rounded bg-black/70 px-2.5 py-1 text-center text-xs font-semibold text-amber-300"
              >
                {cue.text}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Scenes ({timeline.scenes.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {timeline.scenes.map((scene, idx) => (
                <button
                  key={scene.sceneId}
                  type="button"
                  data-testid={`select-scene-${scene.sceneId}`}
                  onClick={() => setSelectedSceneIndex(idx)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    idx === selectedSceneIndex
                      ? 'bg-amber-500 text-white'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Play className="h-3 w-3" />#{idx + 1}
                </button>
              ))}
            </div>
          </div>

          {activeScene && (
            <div className="space-y-2">
              <label
                htmlFor={`scene-headline-input-${activeScene.sceneId}`}
                className="block text-xs font-medium text-muted-foreground"
              >
                Headline ({activeScene.sceneId})
              </label>
              <input
                id={`scene-headline-input-${activeScene.sceneId}`}
                data-testid="scene-headline-input"
                type="text"
                value={activeScene.headline}
                onChange={(e) => updateSceneHeadline(activeScene.sceneId, e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              />
            </div>
          )}

          {timeline.captions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Inline Captions</p>
              <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
                {timeline.captions.map((cue) => (
                  <input
                    key={cue.id}
                    data-testid={`caption-input-${cue.id}`}
                    type="text"
                    value={cue.text}
                    onChange={(e) => updateCaptionText(cue.id, e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground"
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            data-testid="trigger-mp4-render-btn"
            onClick={() => onTriggerRender?.(timeline, engine)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
          >
            <Sparkles className="h-4 w-4" />
            <span>Render 1080x1920 MP4 ({engine})</span>
            <CheckCircle2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
