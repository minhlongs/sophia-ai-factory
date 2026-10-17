'use client';

/**
 * Director's Control Deck — Commercial SaaS & Enterprise License Upgrade Modal
 *
 * Rendered when a self-hosted `COMMUNITY` instance attempts to use a
 * `CLOUD_SAAS` ($199–$799/mo) or `ENTERPRISE_MASTER` ($4,999) capability.
 *
 * Layer: components/open-core
 * @module components/open-core/commercial-upgrade-modal
 */

import React, { useState } from 'react';
import { Cloud, KeyRound, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { FeatureGateEvaluation } from '@/seed/config/edition-config';

export interface CommercialUpgradeModalProps {
  readonly evaluation: FeatureGateEvaluation;
  readonly locale?: 'vi' | 'en';
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmitLicenseKey?: (licenseKey: string) => void;
}

const COPY = {
  vi: {
    badge: 'SOPHIA OPEN-CORE → COMMERCIAL BRIDGE',
    whyCloudHeading: 'Vì sao 95% CEO & Agency chọn Sophia Managed Cloud?',
    whyCloudPoints: [
      'Không cần xin duyệt TikTok / YouTube / Meta OAuth App (mất 2–4 tuần thẩm định).',
      'Hạ tầng Cloudflare Workers + D1 + R2 + Inngest vận hành tự động 24/7, sao lưu mỗi ngày.',
      'Mở khóa Growth Triad v14 (Thompson Sampling MAB + phân bổ vốn Half-Kelly) & Đối soát Affiliate.',
    ],
    cloudCta: 'Nâng cấp lên Sophia Cloud (từ $199/tháng)',
    licenseToggle: 'Đã mua gói Master ($4,999) / Enterprise? Nhập RAAS_LICENSE_KEY',
    licensePlaceholder: 'SOPHIA-RAAS-v1.eyJ...',
    activateBtn: 'Kích hoạt Giấy phép',
    closeBtn: 'Để sau',
  },
  en: {
    badge: 'SOPHIA OPEN-CORE → COMMERCIAL BRIDGE',
    whyCloudHeading: 'Why 95% of CEOs & Agencies choose Sophia Managed Cloud',
    whyCloudPoints: [
      'Skip painful 2–4 week TikTok, YouTube & Meta OAuth developer app reviews.',
      'Zero-ops Cloudflare Workers + D1 + R2 + Inngest durable queues managed 24/7.',
      'Unlock Growth Triad v14 (Thompson Sampling MAB + Half-Kelly allocator) & Affiliate Payouts.',
    ],
    cloudCta: 'Launch Instantly on Sophia Cloud (from $199/mo)',
    licenseToggle: 'Have a Master ($4,999) or Enterprise key? Enter RAAS_LICENSE_KEY',
    licensePlaceholder: 'SOPHIA-RAAS-v1.eyJ...',
    activateBtn: 'Activate License',
    closeBtn: 'Maybe Later',
  },
} as const;

export function CommercialUpgradeModal({
  evaluation,
  locale = 'vi',
  isOpen,
  onClose,
  onSubmitLicenseKey,
}: CommercialUpgradeModalProps) {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');

  if (!isOpen || evaluation.allowed) {
    return null;
  }

  const isVi = locale === 'vi';
  const t = isVi ? COPY.vi : COPY.en;
  const featureTitle = isVi ? evaluation.feature.titleVi : evaluation.feature.titleEn;
  const featureSummary = isVi ? evaluation.feature.summaryVi : evaluation.feature.summaryEn;
  const gateMessage = isVi ? evaluation.messageVi : evaluation.messageEn;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sophia-upgrade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-950 p-6 text-slate-100 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-semibold tracking-wider text-amber-400">
              <Sparkles className="h-3.5 w-3.5" />
              {t.badge}
            </span>
            <h3 id="sophia-upgrade-modal-title" className="text-lg font-bold text-white pt-1">
              {featureTitle}
            </h3>
            <p className="text-xs text-slate-400">{featureSummary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeBtn}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 text-xs text-amber-200/90">
          {gateMessage}
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            {t.whyCloudHeading}
          </h4>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {t.whyCloudPoints.map((pt) => (
              <li key={pt} className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 pt-1">
          <a
            href={evaluation.upgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-3 text-xs font-bold text-white shadow-lg transition"
          >
            <Cloud className="h-4 w-4" />
            {t.cloudCta}
          </a>

          <button
            type="button"
            onClick={() => setShowKeyInput((prev) => !prev)}
            className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {t.licenseToggle}
          </button>

          {showKeyInput && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder={t.licensePlaceholder}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={!licenseKey.trim()}
                onClick={() => onSubmitLicenseKey?.(licenseKey.trim())}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-white transition"
              >
                {t.activateBtn}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
