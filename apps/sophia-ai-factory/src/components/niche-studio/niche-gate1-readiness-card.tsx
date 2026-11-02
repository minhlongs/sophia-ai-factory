/**
 * OPC Gate 1 Pre-Flight Config Presence Card ($0.00 Self-Serve Cockpit)
 *
 * Displays whether the 6 Gate 1 database prerequisites (Workspace Admin, Kill Switch,
 * Voice BYOK row, Video BYOK row, YouTube Channel row, Eligible SaaS/Crypto Offers)
 * are present at $0.00 cost, and provides self-serve CTAs so non-technical CEOs
 * can complete every missing prerequisite from the browser.
 * @module components/niche-studio/niche-gate1-readiness-card
 */

// i18n-namespace: nicheStudio
'use client';

import React, { useState } from 'react';
import { Link } from '@/navigation';
import {
  setOpcWorkspaceKillSwitchAction,
  type OpcGate1ReadinessReport,
} from '@/forest/actions/opc-readiness-actions';
import { NicheGate1ChannelInlineForm } from './niche-gate1-channel-inline-form';

interface NicheGate1ReadinessCardProps {
  report: OpcGate1ReadinessReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  onReportUpdated?: (report: OpcGate1ReadinessReport) => void;
  t: (key: string) => string;
}

export function NicheGate1ReadinessCard({
  report,
  isLoading,
  onRefresh,
  onReportUpdated,
  t,
}: NicheGate1ReadinessCardProps) {
  const [showByokChannelForm, setShowByokChannelForm] = useState(false);
  const [isTogglingKillSwitch, setIsTogglingKillSwitch] = useState(false);

  const ready = Boolean(report?.configPresentForGate1 ?? report?.gate1ReadyForLiveProof);
  const saasCount = report?.eligibleSaasOfferIds.length ?? 0;
  const cryptoCount = report?.eligibleCryptoOfferIds.length ?? 0;
  const offersReady = saasCount > 0 && cryptoCount > 0;
  const channelShortId = report?.youtubeChannelId ? report.youtubeChannelId.slice(0, 12) : null;

  const handleUnlockKillSwitch = async () => {
    setIsTogglingKillSwitch(true);
    try {
      const res = await setOpcWorkspaceKillSwitchAction({ active: false });
      if (res.success && res.data && onReportUpdated) {
        onReportUpdated(res.data);
      } else {
        onRefresh();
      }
    } finally {
      setIsTogglingKillSwitch(false);
    }
  };

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
    {
      key: 'offers',
      label: `${t('readinessOffers')} (SaaS:${saasCount} • Crypto:${cryptoCount})`,
      ok: offersReady,
    },
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
            className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-[11px]"
          >
            <span className="text-zinc-300 truncate">{item.label}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {!item.ok && (item.key === 'voice' || item.key === 'video') && (
                <Link
                  href="/dashboard/setup-wizard"
                  className="text-[10px] text-amber-400 hover:underline font-medium"
                >
                  {t('readinessSetupByokCta')}
                </Link>
              )}
              {!item.ok && item.key === 'killSwitch' && (
                <button
                  type="button"
                  disabled={isTogglingKillSwitch}
                  onClick={handleUnlockKillSwitch}
                  className="text-[10px] text-amber-400 hover:underline font-medium disabled:opacity-50"
                >
                  {t('readinessUnlockKillSwitchCta')}
                </button>
              )}
              {!item.ok && item.key === 'youtube' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.assign('/api/oauth/youtube/connect');
                    }}
                    className="text-[10px] text-amber-400 hover:underline font-medium"
                  >
                    OAuth
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowByokChannelForm((prev) => !prev)}
                    className="text-[10px] text-indigo-400 hover:underline font-medium"
                  >
                    BYOK
                  </button>
                </>
              )}
              <span className={item.ok ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {item.ok ? '✓' : '•'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showByokChannelForm && (
        <NicheGate1ChannelInlineForm
          onSuccess={() => {
            setShowByokChannelForm(false);
            onRefresh();
          }}
          onCancel={() => setShowByokChannelForm(false)}
          t={t}
        />
      )}

      <p className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2">
        💰 {t('readinessBudgetNotice')}
      </p>
    </div>
  );
}
