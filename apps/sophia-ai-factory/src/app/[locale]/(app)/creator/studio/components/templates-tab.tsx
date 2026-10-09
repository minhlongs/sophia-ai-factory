'use client';

import React from 'react';
import { Layers, Plus, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { CreatorTemplate, TemplateStatus } from '@/seed/types/creator-marketplace';
import { formatUsd } from './constants';

interface TemplatesTabProps {
  isVi: boolean;
  loading: boolean;
  templates: CreatorTemplate[];
  onOpenTemplateModal: () => void;
}

export function TemplatesTab({
  isVi,
  loading,
  templates,
  onOpenTemplateModal,
}: TemplatesTabProps) {
  const renderStatusBadge = (status: TemplateStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            {isVi ? 'Đã duyệt' : 'Approved'}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3" />
            {isVi ? 'Đang xét duyệt' : 'Pending Review'}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            {isVi ? 'Từ chối' : 'Rejected'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-zinc-400 border border-zinc-500/20">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        {isVi ? 'Đang tải danh sách mẫu...' : 'Loading templates...'}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl space-y-3">
        <Layers className="h-10 w-10 text-zinc-600 mx-auto" />
        <h3 className="text-base font-semibold text-zinc-300">
          {isVi ? 'Chưa có mẫu video nào' : 'No video templates created yet'}
        </h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          {isVi
            ? 'Bắt đầu đóng gói công thức kịch bản và phong cách viral của bạn để nhận 70% hoa hồng trên mỗi lượt tạo video.'
            : 'Start publishing your viral video recipes and prompts to earn 70% royalties whenever users generate videos.'}
        </p>
        <button
          onClick={onOpenTemplateModal}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          {isVi ? 'Tạo Mẫu Đầu Tiên' : 'Create First Template'}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((tmpl) => (
        <div
          key={tmpl.id}
          className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-5 space-y-4 flex flex-col justify-between hover:border-zinc-700 transition-all"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase font-semibold text-indigo-400 tracking-wider">
                {tmpl.niche} • {tmpl.targetPlatform}
              </span>
              {renderStatusBadge(tmpl.status)}
            </div>
            <h3 className="text-lg font-bold text-zinc-100 line-clamp-1">{tmpl.title}</h3>
            <p className="text-xs text-zinc-400 line-clamp-2">{tmpl.scriptTemplate}</p>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <div>
              <span className="text-zinc-500">{isVi ? 'Giá:' : 'Price:'} </span>
              <span className="text-zinc-200 font-semibold">{formatUsd(tmpl.priceCents)}</span>
              <span className="text-indigo-400 ml-1">
                (70% = {formatUsd(Math.floor(tmpl.priceCents * 0.7))})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>
                {tmpl.useCount} {isVi ? 'dùng' : 'uses'}
              </span>
              {tmpl.rating > 0 && <span>⭐ {tmpl.rating.toFixed(1)}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
