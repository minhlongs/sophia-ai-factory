/**
 * Review Portal Header Component
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/portal-header
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { ReviewPortalBranding } from './types';

interface PortalHeaderProps {
  branding?: ReviewPortalBranding;
  primaryColor: string;
  isVi: boolean;
  onToggleLocale: () => void;
}

export function ReviewPortalHeader({
  branding,
  primaryColor,
  isVi,
  onToggleLocale,
}: PortalHeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.clientName || 'Client Brand'}
              className="h-8 sm:h-9 object-contain max-w-[140px]"
            />
          ) : (
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-white shadow-md"
              style={{ backgroundColor: primaryColor }}
            >
              {branding?.clientName?.slice(0, 2).toUpperCase() || 'SA'}
            </div>
          )}
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              {branding?.clientName || (isVi ? 'Cổng Duyệt Video Khách Hàng' : 'Client Review Portal')}
            </h1>
            <p className="text-xs text-slate-400">
              {isVi ? 'Không gian duyệt sản phẩm truyền thông' : 'Media Draft Review & Approval'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleLocale}
            className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition"
            title={isVi ? 'Chuyển sang tiếng Anh' : 'Switch to Vietnamese'}
          >
            {isVi ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'}
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sophia Verified Secure</span>
          </div>
        </div>
      </div>
    </header>
  );
}
