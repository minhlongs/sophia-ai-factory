'use client';

import React from 'react';
import type { TargetPlatform } from '@/tree/marketplace/types';
import type { SubmitFormData } from './types';

interface SubmitCategorySelectsProps {
  formData: SubmitFormData;
  setFormData: React.Dispatch<React.SetStateAction<SubmitFormData>>;
}

export function SubmitCategorySelects({
  formData,
  setFormData,
}: SubmitCategorySelectsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1">Niche</label>
        <select
          value={formData.niche}
          onChange={(e) => setFormData((prev) => ({ ...prev, niche: e.target.value }))}
          className="w-full rounded-lg border border-white/10 bg-[#1e202e] p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
        >
          <option value="saas">SaaS</option>
          <option value="finance">Finance</option>
          <option value="ecommerce">E-commerce</option>
          <option value="growth_hacking">Growth Hacking</option>
          <option value="tech">Tech & AI</option>
          <option value="fitness">Fitness</option>
          <option value="general">General</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1">Target Platform</label>
        <select
          value={formData.platform}
          onChange={(e) => setFormData((prev) => ({ ...prev, platform: e.target.value as TargetPlatform }))}
          className="w-full rounded-lg border border-white/10 bg-[#1e202e] p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
        >
          <option value="tiktok">TikTok</option>
          <option value="youtube_shorts">YouTube Shorts</option>
          <option value="instagram_reels">Instagram Reels</option>
          <option value="facebook_reels">Facebook Reels</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1">Hook Style</label>
        <select
          value={formData.hookStyle}
          onChange={(e) => setFormData((prev) => ({ ...prev, hookStyle: e.target.value }))}
          className="w-full rounded-lg border border-white/10 bg-[#1e202e] p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
        >
          <option value="curiosity_gap">Curiosity Gap</option>
          <option value="pattern_interrupt">Pattern Interrupt</option>
          <option value="bold_claim">Bold Claim</option>
          <option value="relatable_pain">Relatable Pain</option>
        </select>
      </div>
    </div>
  );
}
