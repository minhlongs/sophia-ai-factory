'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ControlDeckScreenId,
  StitchScreenSpec,
} from '@/seed/types/stitch-control-deck';
import {
  FALLBACK_ROUTE_BY_SCREEN,
  resolveCleanHtmlFile,
  synchronizeStitchIframeDom,
  VIEWPORT_WIDTH_CLASS,
  type ViewportPreset,
} from './stitch-screen-live-canvas-helpers';

export interface StitchScreenLiveCanvasProps {
  readonly activeScreen: StitchScreenSpec;
  readonly lang: 'en' | 'vi';
  readonly screens: readonly StitchScreenSpec[];
  readonly onSelectScreen: (id: ControlDeckScreenId) => void;
}

export function StitchScreenLiveCanvas({
  activeScreen,
  lang,
  screens,
  onSelectScreen,
}: Readonly<StitchScreenLiveCanvasProps>) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [viewport, setViewport] = useState<ViewportPreset>('full');
  const [canvasHeight, setCanvasHeight] = useState<number>(860);
  const activeHtmlFile = resolveCleanHtmlFile(activeScreen);
  const activeRouteBind =
    activeScreen.routeBind ?? FALLBACK_ROUTE_BY_SCREEN[activeScreen.id] ?? '/dashboard';

  const syncIframeDocument = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    synchronizeStitchIframeDom({
      iframe,
      lang,
      screens,
      onSelectScreen,
      onMeasureHeight: setCanvasHeight,
    });
  }, [lang, onSelectScreen, screens]);

  useEffect(() => {
    syncIframeDocument();
  }, [syncIframeDocument, activeHtmlFile]);

  const paddedIndex = String(activeScreen.index).padStart(2, '0');
  const stitchUrl = `/stitch/${activeHtmlFile}`;
  const routeUrl = `/${lang}${activeRouteBind}?demo=1`;

  return (
    <section
      aria-label={
        lang === 'vi'
          ? `Giao diện Stitch v4.2 trực tiếp — ${activeScreen.title.vi}`
          : `Live Stitch v4.2 Screen Canvas — ${activeScreen.title.en}`
      }
      data-testid="stitch-live-canvas-section"
      className="mt-5 min-w-0 rounded-xl border border-amber-400/45 bg-[#121722] p-3 sm:p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_16px_36px_-8px_rgba(0,0,0,0.65)]"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2638] pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            {lang === 'vi' ? `GIAO DIỆN GỐC #${paddedIndex}` : `LIVE SCREEN #${paddedIndex}`}
          </span>
          <span className="truncate font-mono text-xs text-[#94A3B8]">
            {activeHtmlFile} → {activeRouteBind}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['full', 'desktop', 'tablet', 'mobile'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setViewport(preset)}
              className={`min-h-[44px] rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                viewport === preset
                  ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                  : 'border-[#1E2638] bg-[#0B0E14] text-[#94A3B8] hover:border-slate-600 hover:text-[#F8FAFC]'
              }`}
            >
              {preset}
            </button>
          ))}
          <a
            href={routeUrl}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-indigo-400/45 bg-indigo-500/15 px-3 py-1 font-mono text-[11px] font-semibold text-indigo-200 transition-colors motion-reduce:transition-none hover:bg-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {lang === 'vi' ? 'Mở Route Chính ↗' : 'Open App Route ↗'}
          </a>
          <a
            href={stitchUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-amber-400/50 bg-amber-400/15 px-3 py-1 font-mono text-[11px] font-semibold text-amber-300 transition-colors motion-reduce:transition-none hover:bg-amber-400 hover:text-[#0B0E14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {lang === 'vi' ? 'Toàn Màn Hình ↗' : 'Full HTML ↗'}
          </a>
        </div>
      </div>

      <div className={`${VIEWPORT_WIDTH_CLASS[viewport]} overflow-hidden rounded-lg border border-[#1E2638] bg-[#0B0E14]`}>
        <iframe
          ref={iframeRef}
          key={activeHtmlFile}
          src={stitchUrl}
          onLoad={syncIframeDocument}
          title={`${activeScreen.title[lang]} — Stitch v4.2`}
          data-testid="stitch-live-screen-iframe"
          style={{ height: `${canvasHeight}px` }}
          className="w-full border-0 bg-[#0B0E14]"
        />
      </div>
    </section>
  );
}
