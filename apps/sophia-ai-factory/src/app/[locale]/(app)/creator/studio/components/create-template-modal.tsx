'use client';

import React from 'react';
import type { CreatorTemplatePlatform } from '@/seed/types/creator-marketplace';
import type { TemplateFormData } from './types';

interface CreateTemplateModalProps {
  isVi: boolean;
  isOpen: boolean;
  submitting: boolean;
  formData: TemplateFormData;
  onChange: (data: TemplateFormData) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateTemplateModal({
  isVi,
  isOpen,
  submitting,
  formData,
  onChange,
  onClose,
  onSubmit,
}: CreateTemplateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-xl space-y-4 my-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-bold text-zinc-100">
            {isVi ? 'Đóng Gói Mẫu Video Nhà Sáng Tạo' : 'Publish Reusable Video Template'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-sm">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-sm">
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
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                {isVi ? 'Chủ Đề (Niche)' : 'Niche'}
              </label>
              <select
                value={formData.niche}
                onChange={(e) => onChange({ ...formData, niche: e.target.value })}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
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
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="tiktok">TikTok</option>
                <option value="youtube_shorts">YouTube Shorts</option>
                <option value="instagram_reels">Instagram Reels</option>
                <option value="facebook_reels">Facebook Reels</option>
              </select>
            </div>
          </div>

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
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
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
              className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

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
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-indigo-400 mt-1 block">
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
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="9:16">9:16 (Vertical Shorts / Reels)</option>
                <option value="16:9">16:9 (Horizontal)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              {isVi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
            >
              {submitting
                ? isVi ? 'Đang gửi...' : 'Submitting...'
                : isVi ? 'Gửi Duyệt Mẫu' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
