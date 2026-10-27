import React from 'react';
import type {
  WorkflowStationId,
  WorkflowStationItem,
  WorkflowStationState,
} from '@/tree/mission/workflow-view-model';
import { AssemblyLineStationNode } from './assembly-line-station-node';

export interface StationVisualTheme {
  stroke: string;
  badgeBg: string;
  badgeText: string;
  pillClasses: string;
  glyph: string;
}

export const STATION_THEME: Record<WorkflowStationState, StationVisualTheme> = {
  not_started: {
    stroke: '#94A3B8',
    badgeBg: '#E2E8F0',
    badgeText: '#334155',
    pillClasses: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    glyph: '○',
  },
  queued: {
    stroke: '#4338CA',
    badgeBg: '#E0E7FF',
    badgeText: '#3730A3',
    pillClasses: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800',
    glyph: '◷',
  },
  running: {
    stroke: '#4338CA',
    badgeBg: '#4338CA',
    badgeText: '#FFFFFF',
    pillClasses: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/80 dark:text-indigo-100 border-indigo-400 dark:border-indigo-500',
    glyph: '⚙',
  },
  needs_approval: {
    stroke: '#D97706',
    badgeBg: '#FEF3C7',
    badgeText: '#92400E',
    pillClasses: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-400 dark:border-amber-600',
    glyph: '⛨',
  },
  succeeded: {
    stroke: '#059669',
    badgeBg: '#D1FAE5',
    badgeText: '#065F46',
    pillClasses: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
    glyph: '✓',
  },
  failed: {
    stroke: '#E11D48',
    badgeBg: '#FFE4E6',
    badgeText: '#9F1239',
    pillClasses: 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-200 border-rose-300 dark:border-rose-700',
    glyph: '!',
  },
  unknown: {
    stroke: '#64748B',
    badgeBg: '#F1F5F9',
    badgeText: '#475569',
    pillClasses: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    glyph: '•',
  },
};

const COORDS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 110, y: 120 },
  { x: 295, y: 135 },
  { x: 480, y: 150 },
  { x: 665, y: 135 },
  { x: 850, y: 120 },
];

export interface AssemblyLineSvgCanvasProps {
  stations: readonly WorkflowStationItem[];
  selectedId: WorkflowStationId;
  onSelect: (id: WorkflowStationId) => void;
  getShortTitle: (id: WorkflowStationId) => string;
  getStateLabel: (state: WorkflowStationState) => string;
}

export function AssemblyLineSvgCanvas({
  stations,
  selectedId,
  onSelect,
  getShortTitle,
  getStateLabel,
}: AssemblyLineSvgCanvasProps) {
  return (
    <div className="hidden sm:block w-full overflow-x-auto">
      <svg
        viewBox="0 0 960 265"
        role="img"
        aria-label="Sophia Creative Assembly Line Isometric Diagram"
        className="w-full h-auto min-w-[680px] select-none"
      >
        {/* Isometric Workstation Bed Plinth */}
        <polygon
          points="30,130 480,50 930,130 480,245"
          className="fill-slate-100/70 dark:fill-[#0B0E17] stroke-slate-300 dark:stroke-white/10"
          strokeWidth="1.5"
        />

        {/* Conveyor Rails Linking Stations */}
        {COORDS.slice(0, -1).map((pt, idx) => {
          const next = COORDS[idx + 1];
          const st = stations[idx]?.state ?? 'not_started';
          const isFlowing = st === 'running' || st === 'succeeded';
          return (
            <g key={pt.x}>
              <line
                x1={pt.x + 52}
                y1={pt.y - 5}
                x2={next.x - 52}
                y2={next.y - 5}
                stroke={isFlowing ? '#4338CA' : '#CBD5E1'}
                strokeWidth="3"
                strokeDasharray={st === 'running' ? '6 4' : undefined}
              />
            </g>
          );
        })}

        {/* 5 Isometric Production Stations */}
        {stations.map((st, idx) => {
          const coord = COORDS[idx] ?? { x: 110, y: 120 };
          const theme = STATION_THEME[st.state] ?? STATION_THEME.unknown;
          const shortTitle = getShortTitle(st.id);
          const stateLabel = `${theme.glyph} ${getStateLabel(st.state)}`;
          return (
            <g
              key={st.id}
              onClick={() => onSelect(st.id)}
              role="button"
              tabIndex={0}
              aria-label={`${shortTitle} - ${stateLabel}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(st.id);
                }
              }}
            >
              <AssemblyLineStationNode
                id={st.id}
                x={coord.x}
                y={coord.y}
                isSelected={selectedId === st.id}
                strokeColor={theme.stroke}
                badgeBg={theme.badgeBg}
                badgeText={theme.badgeText}
                order={st.order}
                title={shortTitle}
                tag={st.mechanismTag.split(' ')[0] ?? 'SOP'}
                statusText={stateLabel}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
