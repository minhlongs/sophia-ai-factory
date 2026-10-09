/**
 * Audit Vault Explorer Header & Verification Banner
 * Layer: forest/audit (UI components & presentation)
 *
 * @module forest/audit/vault-explorer/header-banner
 */

// i18n-namespace: auditVault

import React from 'react';
import {
  Lock,
  ShieldCheck,
  AlertTriangle,
  Activity,
  RefreshCw,
} from 'lucide-react';
import type { ChainVerificationResult } from './types';

export interface HeaderBannerProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  verification: ChainVerificationResult | null;
  isVerifying: boolean;
  onVerifyChain: () => void;
}

export function HeaderBanner({
  t,
  verification,
  isVerifying,
  onVerifyChain,
}: HeaderBannerProps) {
  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/25">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                {t('title')}
              </h1>
              <p className="text-sm text-zinc-400">{t('subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {verification ? (
            verification.valid ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {t('verifiedBadge', { count: verification.totalEvents })}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-medium text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {t('tamperBadge', { index: verification.tamperedIndex ?? 0 })}
                </span>
              </div>
            )
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/80 px-3.5 py-1.5 text-xs font-medium text-zinc-300">
              <Activity className="h-4 w-4 text-zinc-400" />
              <span>{t('pendingBadge')}</span>
            </div>
          )}

          <button
            onClick={onVerifyChain}
            disabled={isVerifying}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-600/20 px-4 py-2 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-600/30 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isVerifying ? 'animate-spin' : ''}`}
            />
            {isVerifying ? t('verifying') : t('verifyChain')}
          </button>
        </div>
      </div>

      {verification && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">{t('totalEvents')}</span>
            <p className="text-lg font-semibold text-zinc-100">
              {verification.totalEvents}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">{t('verifiedAt')}</span>
            <p className="text-sm font-medium text-zinc-300">
              {new Date(verification.verifiedAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">{t('genesisHash')}</span>
            <p className="font-mono text-xs text-zinc-300">
              {verification.genesisHash
                ? `${verification.genesisHash.slice(0, 10)}...${verification.genesisHash.slice(-8)}`
                : 'None'}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">{t('latestHash')}</span>
            <p className="font-mono text-xs text-zinc-300">
              {verification.latestHash
                ? `${verification.latestHash.slice(0, 10)}...${verification.latestHash.slice(-8)}`
                : 'None'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
