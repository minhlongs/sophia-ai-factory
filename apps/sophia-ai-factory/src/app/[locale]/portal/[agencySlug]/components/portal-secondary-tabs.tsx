'use client';

/**
 * White-Label Client Portal Secondary Tabs (Campaigns, Studio, Support)
 *
 * Layer: land (Client Component)
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-secondary-tabs
 */

import React from 'react';
import type { UnbrandedAgencyPortalConfig } from '@/tree/partners/whitelabel-portal';
import type { VideoDeliverable } from './portal-types';

export { PortalSupportTab, type PortalSupportTabProps } from './portal-support-tab';

export interface PortalCampaignsTabProps {
  agency: UnbrandedAgencyPortalConfig;
  isVi: boolean;
  deliverables: VideoDeliverable[];
}

export function PortalCampaignsTab({ agency, isVi, deliverables }: PortalCampaignsTabProps) {
  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
      <h2 className="text-xl font-bold text-white">
        {isVi ? 'Danh Sách Chiến Dịch & Video Hoàn Thiện' : 'Campaigns & Deliverables'}
      </h2>
      <p className="text-sm text-slate-400">
        {isVi
          ? `Toàn bộ sản phẩm truyền thông được sản xuất và bảo hộ bản quyền dưới sự quản lý của ${agency.brandName}.`
          : `All creative deliverables produced and managed exclusively under the ${agency.brandName} brand.`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {deliverables.map((vid) => (
          <div
            key={vid.id}
            className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-colors"
          >
            <div
              className="w-full h-36 rounded-lg flex items-center justify-center font-bold text-slate-400 text-sm border border-slate-800"
              style={{ backgroundColor: vid.thumbnailColor }}
            >
              ▶ {vid.platform} — {vid.aspectRatio}
            </div>
            <div className="font-semibold text-sm text-slate-200 line-clamp-1">{vid.title}</div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-900">
              <span>{vid.duration}</span>
              <span className="text-emerald-400 font-semibold">{vid.status.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface PortalStudioTabProps {
  isVi: boolean;
}

export function PortalStudioTab({ isVi }: PortalStudioTabProps) {
  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
      <h2 className="text-xl font-bold text-white">
        {isVi ? 'Phòng Sáng Tạo Video Trực Quan' : 'Visual Creative Studio'}
      </h2>
      <p className="text-sm text-slate-400">
        {isVi
          ? 'Công cụ dựng video đa nền tảng với tính năng trích xuất âm thanh, dịch thuật và lồng tiếng tự động 5 ngôn ngữ.'
          : 'Automated video studio with audio extraction, neural translation, and 5-language dubbing.'}
      </p>
      <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-xl space-y-2">
        <div className="text-3xl">🎬</div>
        <div className="font-semibold text-slate-300">
          {isVi ? 'Kéo thả kịch bản hoặc video mẫu vào đây' : 'Drop video brief or template here'}
        </div>
        <p className="text-xs text-slate-500">
          {isVi ? 'Hỗ trợ định dạng MP4, MOV, SRT, VTT (Tối đa 500MB)' : 'Supports MP4, MOV, SRT, VTT (Max 500MB)'}
        </p>
      </div>
    </section>
  );
}
