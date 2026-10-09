'use client';

/**
 * White-Label Client Portal Video Deliverables List
 *
 * Layer: land (Client Component)
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-deliverables-list
 */

import React from 'react';
import type { VideoDeliverable } from './portal-types';

export interface PortalDeliverablesListProps {
  isVi: boolean;
  deliverables: VideoDeliverable[];
}

export function PortalDeliverablesList({ isVi, deliverables }: PortalDeliverablesListProps) {
  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-white">
            {isVi ? 'Sản Phẩm Video Mới Bàn Giao' : 'Recent Video Deliverables'}
          </h3>
          <p className="text-xs text-slate-400">
            {isVi
              ? 'Tải về video chất lượng cao (1080p) hoặc sao chép liên kết chia sẻ cho chiến dịch.'
              : 'Download full HD (1080p) assets or copy direct links for client campaigns.'}
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-800/80">
        {deliverables.map((vid) => (
          <div
            key={vid.id}
            className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-start gap-3.5">
              <div
                className="w-12 h-14 rounded-lg flex items-center justify-center font-bold text-xs text-slate-400 shrink-0 border border-slate-700/60"
                style={{ backgroundColor: vid.thumbnailColor }}
              >
                {vid.aspectRatio}
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-sm text-slate-200">{vid.title}</div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-medium text-slate-300">{vid.platform}</span>
                  <span>•</span>
                  <span>{vid.duration}</span>
                  <span>•</span>
                  <span>{vid.createdAt}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end sm:self-center">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  vid.status === 'ready'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                }`}
              >
                {vid.status === 'ready'
                  ? (isVi ? 'Hoàn thành' : 'Ready')
                  : (isVi ? 'Đang render' : 'Rendering')}
              </span>

              <button
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                onClick={() => alert(isVi ? `Đang chuẩn bị tải về: ${vid.title}` : `Preparing download for: ${vid.title}`)}
              >
                {isVi ? 'Tải HD' : 'Download HD'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
