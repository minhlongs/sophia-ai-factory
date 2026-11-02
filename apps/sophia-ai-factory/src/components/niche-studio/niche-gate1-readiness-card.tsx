/**
 * OPC Gate 1 Pre-Flight Config Presence Card ($0.00 Read-Only Check)
 *
 * Displays whether the 6 Gate 1 database prerequisites (Workspace Admin, Kill Switch,
 * Voice BYOK row, Video BYOK row, YouTube Channel row, Eligible SaaS/Crypto Offers)
 * are present at $0.00 cost, without claiming live provider auth or CEO budget sign-off.
 * @module components/niche-studio/niche-gate1-readiness-card
 */

// i18n-namespace: nicheStudio
'use client';

import React from 'react';
import type { OpcGate1ReadinessReport } from '@/tree/affiliate/readiness/opc-gate1-readiness';

interface NicheGate1ReadinessCardProps {
  report: OpcGate1ReadinessReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  t: (key: string) => string;
}

export function NicheGate1ReadinessCard({
  report,
  isLoading,
  onRefresh,
  t,
}: NicheGate1ReadinessCardProps) {
  const ready = Boolean(report?.configPresentForGate1 ?? report?.gate1ReadyForLiveProof);
  const offersReady = Boolean(
    report && report.eligibleSaasOfferIds.length > 0 && report.eligibleCryptoOfferIds.length > 0,
  );
  const channelShortId = report?.youtubeChannelId ? report.youtubeChannelId.slice(0, 12) : null;

  const items = [
    { key: 'admin', label: t('readinessAdmin'), ok: Boolean(report?.adminAuthorized) },
    { key: 'killSwitch', label: t('readinessKillSwitch'), ok: Boolean(report?.killSwitchReady) },
    { key: 'voice', label: t('readinessVoiceByok'), ok: Boolean(report?.voiceByokReady) },
    { key: 'video', label: t('readinessVideoByok'), ok: Boolean(report?.videoByokReady) },
    {
      key: 'youtube',
      label: channelShortId ? `${t('readinessYoutube')} (${channelShortId})` : t('readinessYoutube'),
      ok: Boolean(report?.youtubeChannelReady),
    },
    { key: 'offers', label: t('readinessOffers'), ok: offersReady },
  ];

  return (
    <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            🛡️ {t('readinessTitle')}
          </h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">{t('readinessSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
              ready
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}
          >
            {ready ? t('readinessBadgeReady') : t('readinessBadgeDraftOnly')}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-[11px] px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50"
          >
            {isLoading ? '...' : t('readinessRefresh')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-[11px]"
          >
            <span className="text-zinc-300 truncate">{item.label}</span>
            <span className={item.ok ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {item.ok ? '✓' : '•'}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2">
        💰 {t('readinessBudgetNotice')}
      </p>
    </div>
  );
}
