'use client';

import React from 'react';
import type { TemplateFormData } from './types';
import { NicheAndPlatformSelectors, PriceAndAspectRatioSelectors } from './create-template-selectors';

export interface CreateTemplateFormFieldsProps {
  isVi: boolean;
  formData: TemplateFormData;
  onChange: (data: TemplateFormData) => void;
}

export function CreateTemplateFormFields({
  isVi,
  formData,
  onChange,
}: CreateTemplateFormFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Tiêu Đề Mẫu Video *' : 'Template Title *'}
        </label>
        <input
          required
          type="text"
          value={formData.title}
          onChange={(e) => onChange({ ...formData, title: e.target.value })}
          placeholder={isVi ? 'VD: Mẫu Mở Đầu 3 Giây Tăng 300% Xem Cho SaaS' : 'e.g., 3-Sec Viral SaaS Hook Recipe'}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-primary"
        />
      </div>

      <NicheAndPlatformSelectors isVi={isVi} formData={formData} onChange={onChange} />

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Kịch Bản Khung (Script Template) *' : 'Script Template *'}
        </label>
        <textarea
          required
          rows={3}
          value={formData.scriptTemplate}
          onChange={(e) => onChange({ ...formData, scriptTemplate: e.target.value })}
          placeholder={isVi ? 'Nhập khung kịch bản với các biến số [SẢN PHẨM], [LỢI ÍCH]...' : 'Enter script with placeholders [PRODUCT], [BENEFIT]...'}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isVi ? 'Prompt Phong Cách Hình Ảnh (Visual Prompt) *' : 'Visual Style Prompt *'}
        </label>
        <textarea
          required
          rows={2}
          value={formData.visualStylePrompt}
          onChange={(e) => onChange({ ...formData, visualStylePrompt: e.target.value })}
          placeholder={isVi ? 'VD: Cinematic 3D product render, high key lighting, 8k resolution' : 'e.g., Cinematic 3D product render, vibrant lighting'}
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-primary"
        />
      </div>

      <PriceAndAspectRatioSelectors isVi={isVi} formData={formData} onChange={onChange} />
    </>
  );
}