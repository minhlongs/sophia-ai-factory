'use client';

import React from 'react';

interface WhitelabelConfigFormProps {
  isVi: boolean;
  wlBrandName: string;
  setWlBrandName: (val: string) => void;
  wlDomain: string;
  setWlDomain: (val: string) => void;
  wlPrimaryColor: string;
  setWlPrimaryColor: (val: string) => void;
  wlAccentColor: string;
  setWlAccentColor: (val: string) => void;
  wlLogoUrl: string;
  setWlLogoUrl: (val: string) => void;
  wlSupportUrl: string;
  setWlSupportUrl: (val: string) => void;
  wlSuccessMsg: string | null;
  wlErrorMsg: string | null;
  isPending: boolean;
  onSaveWhitelabel: (e: React.FormEvent) => void;
}

export function WhitelabelConfigForm({
  isVi,
  wlBrandName,
  setWlBrandName,
  wlDomain,
  setWlDomain,
  wlPrimaryColor,
  setWlPrimaryColor,
  wlAccentColor,
  setWlAccentColor,
  wlLogoUrl,
  setWlLogoUrl,
  wlSupportUrl,
  setWlSupportUrl,
  wlSuccessMsg,
  wlErrorMsg,
  isPending,
  onSaveWhitelabel,
}: WhitelabelConfigFormProps) {
  return (
    <div className="lg:col-span-2 p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-zinc-100">
          {isVi ? 'Thiết Lập Nhãn Trắng & Tên Miền' : 'White-Label Branding Settings'}
        </h3>
        <p className="text-xs text-zinc-400">
          {isVi
            ? 'Tùy biến nhận diện thương hiệu hiển thị trên tên miền riêng của đại lý.'
            : 'Configure your custom domain, colors, and logos for sovereign agency branding.'}
        </p>
      </div>

      {wlSuccessMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-sm">
          {wlSuccessMsg}
        </div>
      )}
      {wlErrorMsg && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
          {wlErrorMsg}
        </div>
      )}

      <form onSubmit={onSaveWhitelabel} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
            {isVi ? 'Tên Thương Hiệu Đại Lý' : 'Brand Name'}
          </label>
          <input
            type="text"
            required
            value={wlBrandName}
            onChange={(e) => setWlBrandName(e.target.value)}
            placeholder="e.g. Nexus AI Video Engine"
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
            {isVi ? 'Tên Miền Tùy Chỉnh' : 'Custom Domain (CNAME target)'}
          </label>
          <input
            type="text"
            value={wlDomain}
            onChange={(e) => setWlDomain(e.target.value.toLowerCase())}
            placeholder="e.g. ai.nexusmedia.com"
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
              {isVi ? 'Màu Chủ Đạo' : 'Primary Color'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={wlPrimaryColor}
                onChange={(e) => setWlPrimaryColor(e.target.value)}
                className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={wlPrimaryColor}
                onChange={(e) => setWlPrimaryColor(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
              {isVi ? 'Màu Điểm Nhấn' : 'Accent Color'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={wlAccentColor}
                onChange={(e) => setWlAccentColor(e.target.value)}
                className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={wlAccentColor}
                onChange={(e) => setWlAccentColor(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
            Logo URL (PNG / SVG)
          </label>
          <input
            type="url"
            value={wlLogoUrl}
            onChange={(e) => setWlLogoUrl(e.target.value)}
            placeholder="https://cdn.youragency.com/logo.png"
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
            Support URL
          </label>
          <input
            type="url"
            value={wlSupportUrl}
            onChange={(e) => setWlSupportUrl(e.target.value)}
            placeholder="https://support.youragency.com"
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-cyan-500 text-sm"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 rounded-xl font-semibold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-colors text-sm disabled:opacity-50"
          >
            {isPending ? 'Saving...' : isVi ? 'Lưu Cấu Hình' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
