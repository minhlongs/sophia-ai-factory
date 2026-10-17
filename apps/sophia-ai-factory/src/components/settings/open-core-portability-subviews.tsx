/**
 * Subviews for Open-Core Portability Panel (Features Matrix & Bundle Box)
 *
 * @module components/settings/open-core-portability-subviews
 */

'use client';

import React from 'react';
import { CheckCircle2, Download, Lock, Shield, Upload } from 'lucide-react';
import type { FeatureGateEvaluation } from '@/seed/config/edition-config';

export interface FeaturesMatrixViewProps {
  readonly edition?: string;
  readonly userTier?: string;
  readonly features: readonly FeatureGateEvaluation[];
  readonly onSelectGate: (gate: FeatureGateEvaluation) => void;
}

export function FeaturesMatrixView({
  edition = 'community',
  userTier,
  features,
  onSelectGate,
}: FeaturesMatrixViewProps) {
  return (
    <div className="rounded-2xl border border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground dark:text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span>Open-Core Edition &amp; Entitlement Matrix</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Active Edition: <strong className="uppercase">{edition}</strong>
          {userTier ? ` • Account Tier: ${userTier}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {features.map((gate) => (
          <div
            key={gate.feature.id}
            className="flex items-center justify-between rounded-xl border border-border dark:border-white/[0.08] p-3 text-xs"
          >
            <div>
              <div className="font-semibold text-foreground dark:text-white">
                {gate.feature.titleEn}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Scope: {gate.feature.scope} • Min Tier: {gate.feature.minPaidTier}
              </div>
            </div>
            {gate.allowed ? (
              <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Unlocked
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSelectGate(gate)}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-amber-400 hover:bg-amber-500/25 font-semibold transition"
              >
                <Lock className="w-3.5 h-3.5" /> Preview / Unlock
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface PortabilityBoxViewProps {
  readonly bundleJson: string;
  readonly setBundleJson: (val: string) => void;
  readonly notice: string | null;
  readonly isBusy: boolean;
  readonly onExport: () => void;
  readonly onImport: () => void;
}

export function PortabilityBoxView({
  bundleJson,
  setBundleJson,
  notice,
  isBusy,
  onExport,
  onImport,
}: PortabilityBoxViewProps) {
  return (
    <div className="rounded-2xl border border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground dark:text-white">
            Workspace Configuration Portability (Self-Host &lt;-&gt; Cloud)
          </h3>
          <p className="text-xs text-muted-foreground">
            Export or import signed non-secret settings (locale, routing strategy, channel presets).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Export from D1
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={isBusy || !bundleJson.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" /> Verify &amp; Import to D1
          </button>
        </div>
      </div>

      <textarea
        rows={6}
        value={bundleJson}
        onChange={(e) => setBundleJson(e.target.value)}
        placeholder='{"config":{"schemaVersion":"sophia-workspace-v1",...},"checksumHex":"..."}'
        className="w-full rounded-xl border border-border dark:border-white/[0.1] bg-background dark:bg-black/40 p-3 font-mono text-xs text-foreground dark:text-slate-200"
      />
      {notice && <p className="text-xs font-medium text-indigo-400">{notice}</p>}
    </div>
  );
}
