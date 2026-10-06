'use client';

/**
 * Autonomous Operations Cockpit - Control Buttons Toolbar
 *
 * @module land/autonomous/cockpit-controls
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertOctagon,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface CockpitControlsProps {
  state: string;
  isPending: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onForceCycle: () => void;
  onResetCircuit: () => void;
  onEmergencyHalt: () => void;
  onRefresh: () => void;
}

export function CockpitControls({
  state,
  isPending,
  onStart,
  onPause,
  onResume,
  onForceCycle,
  onResetCircuit,
  onEmergencyHalt,
  onRefresh,
}: CockpitControlsProps) {
  const t = useTranslations('autonomous');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === 'IDLE' && (
        <button
          onClick={onStart}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {t('controls.start')}
        </button>
      )}

      {state === 'RUNNING' && (
        <button
          onClick={onPause}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
        >
          <Pause className="w-4 h-4" />
          {t('controls.pause')}
        </button>
      )}

      {state === 'PAUSED' && (
        <button
          onClick={onResume}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {t('controls.resume')}
        </button>
      )}

      <button
        onClick={onForceCycle}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors disabled:opacity-50"
      >
        <Zap className="w-4 h-4 text-amber-500" />
        {t('controls.forceCycle')}
      </button>

      {state === 'CIRCUIT_BROKEN' && (
        <button
          onClick={onResetCircuit}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          {t('controls.resetCircuit')}
        </button>
      )}

      <button
        onClick={onEmergencyHalt}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-50"
      >
        <AlertOctagon className="w-4 h-4" />
        {t('controls.emergencyHalt')}
      </button>

      <button
        onClick={onRefresh}
        disabled={isPending}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        title={t('controls.refresh')}
      >
        <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
