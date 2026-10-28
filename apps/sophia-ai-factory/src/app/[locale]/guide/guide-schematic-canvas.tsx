/**
 * guide-schematic-canvas.tsx
 * Pure-SVG schematic of the 5-stage pipeline and the 8 backend pillars.
 * Continuous motion lives in CSS keyframes; the FSM runs a single timer effect.
 */

'use client';

// i18n-namespace: guide

import { useCallback, useEffect, useReducer, type KeyboardEvent } from 'react';
import {
  buildGuideCanvasNodes,
  buildGuideSerialPayload,
  type GuideSchematicCanvasLabels,
  type SimPhase,
} from './guide-schematic-nodes';
import { GuideCanvasNodeView } from './guide-schematic-node-view';
import { GUIDE_CIRCUIT_WIRES, GUIDE_SVG_COORDS, type GuideActiveTarget } from '@/seed/guide';

export type { GuideSchematicCanvasLabels } from './guide-schematic-nodes';

export interface GuideSchematicCanvasProps {
  readonly activeTarget: GuideActiveTarget;
  readonly locale: 'vi' | 'en';
  readonly onSelect: (target: GuideActiveTarget) => void;
  readonly labels: GuideSchematicCanvasLabels;
}

type SimAction = { readonly type: 'ADVANCE' } | { readonly type: 'TOGGLE' } | { readonly type: 'RESET' };

const PHASES: readonly SimPhase[] = ['IDLE', 'INPUT', 'ENGINE', 'OUTPUT'];
const PHASE_MS: Record<SimPhase, number> = { IDLE: 900, INPUT: 900, ENGINE: 1100, OUTPUT: 1400 };
const [, , CANVAS_WIDTH, CANVAS_HEIGHT] = GUIDE_SVG_COORDS.viewBox.split(' ');

interface SimState {
  readonly phase: SimPhase;
  readonly isPlaying: boolean;
}

function simReducer(state: SimState, action: SimAction): SimState {
  if (action.type === 'TOGGLE') return { phase: 'IDLE', isPlaying: !state.isPlaying };
  if (action.type === 'RESET') return { phase: 'IDLE', isPlaying: false };
  const next = PHASES[(PHASES.indexOf(state.phase) + 1) % PHASES.length] ?? 'IDLE';
  return { phase: next, isPlaying: true };
}

export function GuideSchematicCanvas({
  activeTarget,
  locale,
  onSelect,
  labels,
}: GuideSchematicCanvasProps) {
  const [sim, dispatch] = useReducer(simReducer, { phase: 'IDLE', isPlaying: false });

  // One timer keyed on (isPlaying, phase); cleared on every change and on unmount.
  useEffect(() => {
    if (!sim.isPlaying) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'ADVANCE' }), PHASE_MS[sim.phase]);
    return () => clearTimeout(timer);
  }, [sim.isPlaying, sim.phase]);

  useEffect(() => () => dispatch({ type: 'RESET' }), []);

  const activate = useCallback(
    (event: KeyboardEvent, target: GuideActiveTarget) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onSelect(target);
    },
    [onSelect],
  );

  const nodes = buildGuideCanvasNodes(activeTarget, locale, labels.stationPrefix, labels.pillarPrefix);
  const serial = buildGuideSerialPayload(activeTarget, locale, labels.serialEmpty);

  return (
    <div className="w-full overflow-x-auto snap-x">
      <svg
        viewBox={GUIDE_SVG_COORDS.viewBox}
        role="group"
        aria-label={labels.canvasLabel}
        className="h-auto w-full min-w-[560px]"
      >
        <defs>
          <pattern id="guide-pcb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" className="stroke-border/60" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#guide-pcb-grid)" />

        {GUIDE_CIRCUIT_WIRES.map((wire) => {
          const a = GUIDE_SVG_COORDS.stations[wire.stageStep - 1];
          const b = GUIDE_SVG_COORDS.chips[wire.pillarNumber - 1];
          const d = `M${a.x},${a.y} L${b.x},${b.y}`;
          return (
            <g key={`w-${wire.stageStep}-${wire.pillarNumber}`}>
              <path d={d} pathLength="100" fill="none" className="stroke-border" strokeWidth="1.5" />
              {sim.isPlaying && (
                <path d={d} pathLength="100" fill="none" strokeWidth="2" className="guide-signal-flow" />
              )}
            </g>
          );
        })}

        {nodes.map((node) => (
          <GuideCanvasNodeView
            key={node.id}
            node={node}
            labels={labels}
            onSelect={onSelect}
            onKeyDown={activate}
          />
        ))}
      </svg>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE' })}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-accent"
        >
          {sim.isPlaying ? labels.stop : labels.simulate}
        </button>
        <span className="font-mono text-[11px] text-muted-foreground">{labels.phases[sim.phase]}</span>
      </div>

      <pre className="mt-2 max-h-28 overflow-auto rounded-lg border border-border bg-background/70 p-3 font-mono text-[11px] text-foreground">
        {serial}
      </pre>
    </div>
  );
}
