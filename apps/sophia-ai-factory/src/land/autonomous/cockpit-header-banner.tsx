'use client';

/**
 * Autonomous Operations Cockpit Header & Status Alert Banner
 *
 * Layer: land/autonomous (Interactive Client Component)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module land/autonomous/cockpit-header-banner
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import type { AutonomousEngineState } from '@/seed/types/autonomous-engine';
import { CockpitStateBadge } from './cockpit-state-badge';
import { CockpitControls } from './cockpit-controls';

export interface CockpitStatusMessage {
  type: 'success' | 'error';
  text: string;
}

export interface CockpitHeaderBannerProps {
  state: AutonomousEngineState;
  isPending: boolean;
  statusMessage: CockpitStatusMessage | null;
  onDismissStatus: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onForceCycle: () => void;
  onResetCircuit: () => void;
  onEmergencyHalt: () => void;
  onRefresh: () => void;
}

export function CockpitHeaderBanner({
  state,
  isPending,
  statusMessage,
  onDismissStatus,
  onStart,
  onPause,
  onResume,
  onForceCycle,
  onResetCircuit,
  onEmergencyHalt,
  onRefresh,
}: CockpitHeaderBannerProps) {
  const t = useTranslations('autonomous');

  const getStateLabel = (st: string) => {
    switch (st) {
      case 'RUNNING':
        return t('status.running');
      case 'PAUSED':
        return t('status.paused');
      case 'RECOVERING':
        return t('status.recovering');
      case 'CIRCUIT_BROKEN':
        return t('status.circuitBroken');
      case 'IDLE':
      default:
        return t('status.idle');
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-card border border-border rounded-xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
            <CockpitStateBadge state={state} label={getStateLabel(state)} />
          </div>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <CockpitControls
          state={state}
          isPending={isPending}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onForceCycle={onForceCycle}
          onResetCircuit={onResetCircuit}
          onEmergencyHalt={onEmergencyHalt}
          onRefresh={onRefresh}
        />
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={onDismissStatus}
            className="text-xs font-semibold uppercase hover:underline"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
