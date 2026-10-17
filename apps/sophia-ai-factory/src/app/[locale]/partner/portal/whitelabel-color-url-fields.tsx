'use client';

import React from 'react';

export interface WhitelabelColorAndUrlFieldsProps {
  isVi: boolean;
  wlPrimaryColor: string;
  setWlPrimaryColor: (val: string) => void;
  wlAccentColor: string;
  setWlAccentColor: (val: string) => void;
  wlLogoUrl: string;
  setWlLogoUrl: (val: string) => void;
  wlSupportUrl: string;
  setWlSupportUrl: (val: string) => void;
}

export function WhitelabelColorAndUrlFields({
  isVi,
  wlPrimaryColor,
  setWlPrimaryColor,
  wlAccentColor,
  setWlAccentColor,
  wlLogoUrl,
  setWlLogoUrl,
  wlSupportUrl,
  setWlSupportUrl,
}: WhitelabelColorAndUrlFieldsProps) {
  return (
    <>
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
    </>
  );
}
