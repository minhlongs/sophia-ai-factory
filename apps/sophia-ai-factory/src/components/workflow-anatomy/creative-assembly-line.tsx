'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  WorkflowStationId,
  WorkflowView,
} from '@/tree/mission/workflow-view-model';
import { AssemblyLineSvgCanvas, STATION_THEME } from './assembly-line-svg-canvas';
import { getStationText, getStateText } from './assembly-line-copy';
import { ConvergenceOutcomeStrip } from './convergence-outcome-strip';

export interface CreativeAssemblyLineProps {
  workflow: WorkflowView;
}

export function CreativeAssemblyLine({ workflow }: CreativeAssemblyLineProps) {
  const t = useTranslations('stitch.landing');
  const [selectedId, setSelectedId] = useState<WorkflowStationId>(workflow.activeStationId);

  const activeStation =
    workflow.stations.find((s) => s.id === selectedId) ?? workflow.stations[0];
  const activeCopy = getStationText(t, activeStation.id);
  const activeTheme = STATION_THEME[activeStation.state] ?? STATION_THEME.unknown;
  const isVerified = workflow.mode === 'verified-job';

  return (
    <div
      data-testid="creative-assembly-line"
      data-workflow-mode={workflow.mode}
      className="w-full space-y-4 text-left"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h3 className="text-sm font-bold text-[#0B0F19] dark:text-white">
            {t('assemblyLine.title')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isVerified ? t('assemblyLine.subtitleVerified') : t('assemblyLine.subtitleIllustration')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4338CA]/30 bg-[#4338CA]/10 dark:bg-[#6366F1]/15 px-3 py-1 text-[11px] font-mono font-semibold text-[#4338CA] dark:text-indigo-300">
          {isVerified ? t('assemblyLine.modeVerified') : t('assemblyLine.modeIllustration')}
        </span>
      </div>

      <AssemblyLineSvgCanvas
        stations={workflow.stations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        getShortTitle={(id) => getStationText(t, id).shortTitle}
        getStateLabel={(st) => getStateText(t, st)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2" role="tablist">
        {workflow.stations.map((station) => {
          const copy = getStationText(t, station.id);
          const theme = STATION_THEME[station.state] ?? STATION_THEME.unknown;
          const isSelected = station.id === selectedId;
          return (
            <button
              key={station.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedId(station.id)}
              className={`min-h-[48px] flex flex-col justify-between rounded-xl border p-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#4338CA] ${
                isSelected
                  ? 'border-[#4338CA] bg-[#4338CA]/[0.06] dark:border-[#6366F1] dark:bg-[#6366F1]/15 shadow-sm'
                  : 'border-[#E2E8F0] dark:border-white/10 bg-[#F8F9FC] dark:bg-[#090A10]/60 hover:border-slate-300'
              }`}
            >
              <span className="text-xs font-bold text-[#0B0F19] dark:text-white">
                {copy.title}
              </span>
              <span
                className={`mt-1.5 inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-mono font-semibold ${theme.pillClasses}`}
              >
                <span>{theme.glyph}</span>
                <span>{getStateText(t, station.state)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="rounded-xl border border-[#E2E8F0] dark:border-white/10 bg-[#F8F9FC] dark:bg-[#090A10]/80 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-[#4338CA] dark:text-indigo-300">
            {t('assemblyLine.inspectorLabel')}: {activeCopy.title}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-mono font-semibold ${activeTheme.pillClasses}`}
          >
            {activeTheme.glyph} {getStateText(t, activeStation.state)}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {activeCopy.summary}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0] dark:border-white/10 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>
            {t('assemblyLine.mechanismLabel')}: <strong className="text-[#0B0F19] dark:text-white">{activeStation.mechanismTag}</strong>
          </span>
          {activeStation.errorMessage && (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">
              {activeStation.errorMessage}
            </span>
          )}
        </div>
      </div>

      {workflow.convergence && (
        <ConvergenceOutcomeStrip convergence={workflow.convergence} />
      )}
    </div>
  );
}
