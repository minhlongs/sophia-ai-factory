'use client';

/**
 * White-Label Client Portal Navigation Header
 *
 * Layer: land (Client Component)
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-header
 */

import React from 'react';
import type { UnbrandedAgencyPortalConfig } from '@/tree/partners/whitelabel-portal';
import type { PortalTab } from './portal-types';

export interface PortalHeaderProps {
  agency: UnbrandedAgencyPortalConfig;
  isVi: boolean;
  activeTab: PortalTab;
  onSelectTab: (tab: PortalTab) => void;
}

export function PortalHeader({ agency, isVi, activeTab, onSelectTab }: PortalHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3.5">
        {agency.logoUrl ? (
          <img
            src={agency.logoUrl}
            alt={agency.brandName}
            className="h-9 max-w-[180px] object-contain"
          />
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-sm"
              style={{ backgroundColor: 'var(--brand-primary, #06b6d4)' }}
            >
              {agency.brandName.charAt(0).toUpperCase()}
            </div>
            <span className="font-bold text-lg tracking-tight text-white">
              {agency.brandName}
            </span>
          </div>
        )}

        <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300">
            {agency.portalTitle}
          </span>
        </div>
      </div>

      <nav className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-sm">
        {(
          [
            { id: 'overview', vi: 'Tổng quan', en: 'Overview' },
            { id: 'campaigns', vi: 'Chiến dịch & Video', en: 'Campaigns & Videos' },
            { id: 'studio', vi: 'Studio Sáng tạo', en: 'Creative Studio' },
            { id: 'support', vi: 'Hỗ trợ', en: 'Support' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {isVi ? tab.vi : tab.en}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-semibold">
          <a
            href={`/en/portal/${agency.agencySlug}`}
            className={`px-2 py-1 rounded transition-colors ${
              !isVi ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            EN
          </a>
          <a
            href={`/vi/portal/${agency.agencySlug}`}
            className={`px-2 py-1 rounded transition-colors ${
              isVi ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            VI
          </a>
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div
            className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-300"
            title={isVi ? 'Tài khoản khách hàng' : 'Client Account'}
          >
            CL
          </div>
        </div>
      </div>
    </header>
  );
}
