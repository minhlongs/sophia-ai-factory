'use client';

/**
 * White-Label Client Portal Video Request Form
 *
 * Layer: land (Client Component)
 *
 * @module app/[locale]/portal/[agencySlug]/components/portal-video-request-form
 */

import React from 'react';
import type { VideoAspectRatio } from './portal-types';

export interface PortalVideoRequestFormProps {
  isVi: boolean;
  promptInput: string;
  setPromptInput: (val: string) => void;
  selectedRatio: VideoAspectRatio;
  setSelectedRatio: (ratio: VideoAspectRatio) => void;
  selectedLang: string;
  setSelectedLang: (lang: string) => void;
  isSubmitting: boolean;
  submitSuccess: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function PortalVideoRequestForm({
  isVi,
  promptInput,
  setPromptInput,
  selectedRatio,
  setSelectedRatio,
  selectedLang,
  setSelectedLang,
  isSubmitting,
  submitSuccess,
  onSubmit,
}: PortalVideoRequestFormProps) {
  return (
    <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            {isVi ? 'Yêu Cầu Sản Xuất Video Nhanh' : 'Quick Video Production Request'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            {isVi
              ? 'Nhập kịch bản hoặc ý tưởng video, hệ thống tự động lồng tiếng và sinh phụ đề đa ngữ.'
              : 'Input your video prompt or hook script. The automated pipeline generates localized audio and captions.'}
          </p>
        </div>
      </div>

      {submitSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-sm flex items-center gap-2">
          <span>✓</span>
          {isVi
            ? 'Yêu cầu sản xuất video đã được tiếp nhận và đưa vào hàng đợi xử lý!'
            : 'Video request queued successfully into the production pipeline!'}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            {isVi ? 'Ý tưởng / Hook Kịch bản' : 'Video Prompt / Hook Script'}
          </label>
          <textarea
            rows={3}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder={
              isVi
                ? 'Ví dụ: 3 Sai lầm khiến chiến dịch quảng cáo TikTok Shorts không đạt chuyển đổi...'
                : 'e.g. 3 critical mistakes that kill your TikTok Shorts conversion rates in 2026...'
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              {isVi ? 'Tỷ lệ Khung hình' : 'Aspect Ratio'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['9:16', '16:9', '1:1'] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setSelectedRatio(ratio)}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                    selectedRatio === ratio
                      ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              {isVi ? 'Ngôn ngữ Lồng tiếng & Phụ đề' : 'Voice Dubbing & Subtitles'}
            </label>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="VI">Tiếng Việt (Vietnamese)</option>
              <option value="EN">English (US)</option>
              <option value="JA">日本語 (Japanese)</option>
              <option value="KO">한국어 (Korean)</option>
              <option value="TH">ไทย (Thai)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !promptInput.trim()}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
            style={{ backgroundColor: 'var(--brand-primary, #06b6d4)' }}
          >
            {isSubmitting
              ? (isVi ? 'Đang gửi...' : 'Submitting...')
              : (isVi ? 'Khởi Tạo Video' : 'Generate Video')}
          </button>
        </div>
      </form>
    </section>
  );
}
