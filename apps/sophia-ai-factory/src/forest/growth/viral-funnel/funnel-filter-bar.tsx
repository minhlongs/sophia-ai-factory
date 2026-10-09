/**
 * Viral Funnel Filter and Search Bar
 *
 * Layer: Forest (UI components & coordinators)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/viral-funnel/funnel-filter-bar
 */

import React from 'react';
import { Filter } from 'lucide-react';
import type { ViralNiche, ViralPlatform } from '@/seed/types/growth';

interface FunnelFilterBarProps {
  selectedNiche: ViralNiche | 'all';
  setSelectedNiche: (niche: ViralNiche | 'all') => void;
  selectedPlatform: ViralPlatform | 'all';
  setSelectedPlatform: (platform: ViralPlatform | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isVi: boolean;
}

export function FunnelFilterBar({
  selectedNiche,
  setSelectedNiche,
  selectedPlatform,
  setSelectedPlatform,
  searchQuery,
  setSearchQuery,
  isVi,
}: FunnelFilterBarProps) {
  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>{isVi ? 'Lọc:' : 'Filter:'}</span>
        </div>

        {/* Niche Filter */}
        <select
          value={selectedNiche}
          onChange={(e) => setSelectedNiche(e.target.value as ViralNiche | 'all')}
          className="px-3 py-1.5 rounded-lg text-xs bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="all">{isVi ? 'Tất Cả Lĩnh Vực' : 'All Niches'}</option>
          <option value="ai_automation">{isVi ? 'Tự Động Hóa AI' : 'AI Automation'}</option>
          <option value="ecommerce">{isVi ? 'Thương Mại Điện Tử' : 'E-commerce'}</option>
          <option value="solopreneur">{isVi ? 'Kinh Doanh Độc Lập' : 'Solopreneur'}</option>
        </select>

        {/* Platform Filter */}
        <select
          value={selectedPlatform}
          onChange={(e) => setSelectedPlatform(e.target.value as ViralPlatform | 'all')}
          className="px-3 py-1.5 rounded-lg text-xs bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="all">{isVi ? 'Tất Cả Nền Tảng' : 'All Platforms'}</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube_shorts">YouTube Shorts</option>
          <option value="twitter">X (Twitter)</option>
        </select>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder={isVi ? 'Tìm kiếm theo tiêu đề video...' : 'Search by video title...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-64 px-3 py-1.5 rounded-lg text-xs bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
    </div>
  );
}
