'use client';

/**
 * Niche, Platform, Price and Aspect Ratio selectors for CreateTemplateFormFields.
 * Layer: app/[locale]/(app)/creator/studio/components
 * @module app/[locale]/(app)/creator/studio/components/create-template-selectors
 */

import React from 'react';
import type { CreatorTemplatePlatform } from '@/seed/types/creator-marketplace';
import type { TemplateFormData } from './types';

interface Props {
  isVi: boolean;
  formData: TemplateFormData;
  onChange: (data: TemplateFormData) => void;
}

export function NicheAndPlatformSelectors({ isVi, formData, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Chủ Đề (Niche)' : 'Niche'}
        </label>
        <select
          value={formData.niche}
          onChange={(e) => onChange({ ...formData, niche: e.target.value })}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-primary"
        >
          <option value="general">{isVi ? 'Tổng hợp' : 'General'}</option>
          <option value="saas">SaaS / Công nghệ</option>
          <option value="ecommerce">E-commerce / Thương mại điện tử</option>
          <option value="finance">Tài chính / Crypto</option>
          <option value="fitness">Thể hình / Đời sống</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Nền Tảng Đích' : 'Target Platform'}
        </label>
        <select
          value={formData.targetPlatform}
          onChange={(e) => onChange({ ...formData, targetPlatform: e.target.value as CreatorTemplatePlatform })}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-primary"
        >
          <option value="tiktok">TikTok</option>
          <option value="youtube_shorts">YouTube Shorts</option>
          <option value="instagram_reels">Instagram Reels</option>
          <option value="facebook_reels">Facebook Reels</option>
        </select>
      </div>
    </div>
  );
}

export function PriceAndAspectRatioSelectors({ isVi, formData, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Giá Mẫu ($ USD)' : 'Template Price ($ USD)'}
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={formData.priceDollars}
          onChange={(e) => onChange({ ...formData, priceDollars: e.target.value })}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-primary"
        />
        <span className="text-xs text-primary-400 mt-1 block">
          {isVi ? 'Bạn nhận 70% trên mỗi lượt dùng' : 'You earn 70% royalty on each run'}
        </span>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Tỉ Lệ Khung Hình' : 'Aspect Ratio'}
        </label>
        <select
          value={formData.aspectRatio}
          onChange={(e) => onChange({ ...formData, aspectRatio: e.target.value as '9:16' | '16:9' | '1:1' })}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-primary"
        >
          <option value="9:16">9:16 (Vertical Shorts / Reels)</option>
          <option value="16:9">16:9 (Horizontal)</option>
          <option value="1:1">1:1 (Square)</option>
        </select>
      </div>
    </div>
  );
}