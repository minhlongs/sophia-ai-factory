'use client';

/**
 * Arbitrage Card Main Container View
 *
 * @module components/growth/arbitrage/arbitrage-card-view
 */

import React, { useState } from 'react';
import {
  type ArbitrageCardProps,
  DEFAULT_PLATFORM_MATRIX,
  DICTIONARY,
} from './types';
import { ArbitrageCardHeader } from './arbitrage-card-header';
import { ArbitrageKpiRow } from './arbitrage-kpi-row';
import { PlatformMatrixTable } from './platform-matrix-table';
import { OpportunisticComputeHudCard } from './opportunistic-compute-hud-card';

export { ArbitrageCardHeader } from './arbitrage-card-header';

export function ArbitrageCardView({
  data,
  locale = 'en',
  onRecalibrate,
  onExecute,
  className = '',
}: ArbitrageCardProps) {
  const dict = locale === 'vi' ? DICTIONARY.vi : DICTIONARY.en;

  const [isRecalibrating, setIsRecalibrating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const reachLift = data?.reachLiftPercentage ?? 34.8;
  const reachLiftComparison = data?.reachLiftComparison ?? dict.reachLiftComparison;
  const computeSavings = data?.computeSavingsUsd ?? 418.5;
  const computeSavingsNote = data?.computeSavingsNote ?? dict.computeSavingsNote;
  const hookDivergence = data?.activeHookDivergenceJsd ?? 0.142;
  const divergenceNote = data?.divergenceNote ?? dict.hookDivergenceNote;
  const shadowbanRate = data?.shadowbanAvoidanceRate ?? 99.8;
  const shadowbanNote = data?.shadowbanNote ?? dict.shadowbanNote;

  const platformMatrix = data?.platformMatrix ?? DEFAULT_PLATFORM_MATRIX;

  const regimeBadge = data?.computeHud?.regime ?? dict.regimeOffPeak;
  const regimeDesc = data?.computeHud?.regimeDescription ?? dict.regimeOffPeakDesc;
  const heygenDispatched = data?.computeHud?.heygenDispatched ?? 18;
  const heygenCapacity = data?.computeHud?.heygenCapacityPercent ?? 75;
  const didDispatched = data?.computeHud?.didDispatched ?? 42;
  const didCapacity = data?.computeHud?.didCapacityPercent ?? 45;
  const circuitBreakerStatus = data?.computeHud?.circuitBreakerStatus ?? dict.circuitBreakerHealthy;

  const handleRecalibrate = async () => {
    try {
      setIsRecalibrating(true);
      setFeedback(null);
      if (onRecalibrate) {
        await onRecalibrate();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      setFeedback(dict.actionSuccess);
    } catch {
      // Graceful handling without console.error
    } finally {
      setIsRecalibrating(false);
    }
  };

  const handleExecute = async () => {
    try {
      setIsExecuting(true);
      setFeedback(null);
      if (onExecute) {
        await onExecute();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      setFeedback(dict.actionSuccess);
    } catch {
      // Graceful handling without console.error
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={`max-w-6xl mx-auto space-y-6 text-[#1C1C28] ${className}`}>
      <ArbitrageCardHeader
        dict={dict}
        isRecalibrating={isRecalibrating}
        isExecuting={isExecuting}
        feedback={feedback}
        onRecalibrate={handleRecalibrate}
        onExecute={handleExecute}
      />

      <ArbitrageKpiRow
        dict={dict}
        reachLift={reachLift}
        reachLiftComparison={reachLiftComparison}
        computeSavings={computeSavings}
        computeSavingsNote={computeSavingsNote}
        hookDivergence={hookDivergence}
        divergenceNote={divergenceNote}
        shadowbanRate={shadowbanRate}
        shadowbanNote={shadowbanNote}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PlatformMatrixTable dict={dict} platformMatrix={platformMatrix} />
        <OpportunisticComputeHudCard
          dict={dict}
          regimeBadge={regimeBadge}
          regimeDesc={regimeDesc}
          heygenDispatched={heygenDispatched}
          heygenCapacity={heygenCapacity}
          didDispatched={didDispatched}
          didCapacity={didCapacity}
          circuitBreakerStatus={circuitBreakerStatus}
        />
      </div>
    </div>
  );
}
