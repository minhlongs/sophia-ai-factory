'use client';

import React from 'react';
import { CheckCircle2, Copy, Globe, CreditCard, Clock } from 'lucide-react';
import type { PartnerProfile } from '@/tree/partners/types';
import type { PortalTab } from './types';

interface PortalHeaderProps {
  profile: PartnerProfile;
  isVi: boolean;
  copied: boolean;
  copyReferralUrl: () => void;
  activeTab: PortalTab;
  setActiveTab: (tab: PortalTab) => void;
  isPlatinum: boolean;
}

export function PortalHeader({
  profile,
  isVi,
  copied,
  copyReferralUrl,
  activeTab,
  setActiveTab,
  isPlatinum,
}: PortalHeaderProps) {
  return (
    <>
      {/* Header & Tier Badge */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">
              {profile.partner_name}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${
                profile.tier === 'PLATINUM'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                  : profile.tier === 'GOLD'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
              }`}
            >
              {profile.tier} TIER ({profile.commission_rate_pct}%)
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            {isVi
              ? 'Cổng quản trị đại lý, hoa hồng và nhãn trắng thương hiệu.'
              : 'Partner management, commissions ledger, and white-label engine.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={copyReferralUrl}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-200 transition-colors"
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-zinc-400" />
            )}
            {copied
              ? isVi
                ? 'Đã Sao Chép!'
                : 'Copied!'
              : isVi
              ? 'Sao Chép Link Giới Thiệu'
              : 'Copy Referral Link'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-800 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isVi ? 'Tổng Quan' : 'Overview'}
        </button>
        <button
          onClick={() => setActiveTab('whitelabel')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'whitelabel'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          {isVi ? 'Động Cơ Nhãn Trắng' : 'White-Label Engine'}
          {!isPlatinum && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              LOCKED
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'payouts'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          {isVi ? 'Rút Tiền Hoa Hồng' : 'Payouts'}
        </button>
        <button
          onClick={() => setActiveTab('commissions')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'commissions'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          {isVi ? 'Lịch Sử Đơn Hàng' : 'Commissions History'}
        </button>
      </div>
    </>
  );
}
