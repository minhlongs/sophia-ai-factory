'use client';

/**
 * Viral Video Funnel Management Dashboard View
 *
 * Real-time performance dashboard for viral short-form video lead generation
 * across TikTok, YouTube Shorts, and X (Twitter).
 *
 * Layer: Forest (UI components & coordinators, imports seed and tree)
 *
 * @module forest/growth/viral-funnel-view
 */

import React, { useState, useMemo } from 'react';
import {
  Eye,
  MousePointerClick,
  Users,
  TrendingUp,
  Video,
  Sparkles,
  Share2,
  Copy,
  Check,
  Filter,
  DollarSign,
  Play,
  Flame,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';
import type {
  ViralFunnelOverview,
  ViralVideoFunnelItem,
  ViralNiche,
  HookArchetype,
  ViralPlatform,
  ViralHook,
  ViralScript,
} from '@/seed/types/growth';
import { generateViralHooks, generateViralScript } from '@/tree/viral/hook-generator';
import { buildFunnelTrackingUrl, buildTelegramDeepLink } from '@/forest/publishing/viral-distributor';

export interface ViralFunnelViewProps {
  initialOverview: ViralFunnelOverview;
  locale?: 'en' | 'vi';
}

export function ViralFunnelView({ initialOverview, locale = 'vi' }: ViralFunnelViewProps) {
  const isVi = locale === 'vi';

  // Filters & Search
  const [selectedNiche, setSelectedNiche] = useState<ViralNiche | 'all'>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<ViralPlatform | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Generator Drawer State
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [genNiche, setGenNiche] = useState<ViralNiche>('ai_automation');
  const [genArchetype, setGenArchetype] = useState<HookArchetype>('curiosity_gap');
  const [genTopic, setGenTopic] = useState('');
  const [generatedHooks, setGeneratedHooks] = useState<ViralHook[]>([]);
  const [selectedHook, setSelectedHook] = useState<ViralHook | null>(null);
  const [activeScript, setActiveScript] = useState<ViralScript | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Copy Feedback State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return initialOverview.items.filter((item) => {
      if (selectedNiche !== 'all' && item.niche !== selectedNiche) return false;
      if (selectedPlatform !== 'all' && item.platform !== selectedPlatform) return false;
      if (
        searchQuery.trim() &&
        !item.videoTitle.toLowerCase().includes(searchQuery.toLowerCase().trim())
      ) {
        return false;
      }
      return true;
    });
  }, [initialOverview.items, selectedNiche, selectedPlatform, searchQuery]);

  // Handle Hook Generation
  const handleGenerateHooks = async () => {
    setIsGenerating(true);
    try {
      const hooks = await generateViralHooks({
        niche: genNiche,
        archetype: genArchetype,
        customTopic: genTopic,
        count: 4,
      });
      setGeneratedHooks(hooks);
      if (hooks.length > 0) {
        setSelectedHook(hooks[0]);
        const script = await generateViralScript({
          niche: genNiche,
          hook: hooks[0],
          targetDurationSec: 30,
        });
        setActiveScript(script);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectHook = async (hook: ViralHook) => {
    setSelectedHook(hook);
    setIsGenerating(true);
    try {
      const script = await generateViralScript({
        niche: genNiche,
        hook,
        targetDurationSec: 30,
      });
      setActiveScript(script);
    } finally {
      setIsGenerating(false);
    }
  };

  const getNicheBadge = (niche: ViralNiche) => {
    switch (niche) {
      case 'ai_automation':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {isVi ? 'Tự Động Hóa AI' : 'AI Automation'}
          </span>
        );
      case 'ecommerce':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            {isVi ? 'Thương Mại Điện Tử' : 'E-commerce'}
          </span>
        );
      case 'solopreneur':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {isVi ? 'Kinh Doanh Độc Lập' : 'Solopreneur'}
          </span>
        );
    }
  };

  const getPlatformBadge = (platform: ViralPlatform | 'all') => {
    switch (platform) {
      case 'tiktok':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
            TikTok
          </span>
        );
      case 'youtube_shorts':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            YT Shorts
          </span>
        );
      case 'twitter':
      case 'x':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            X (Twitter)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-300">
            Multi
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isVi ? 'Phễu Video Viral & Kéo Khách Đa Kênh' : 'Viral Video & Multi-Channel Funnel'}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-emerald-500/20 to-indigo-500/20 text-emerald-400 border border-emerald-500/30">
              <Flame className="w-3 h-3 text-emerald-400 animate-pulse" />
              Live D1
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            {isVi
              ? 'Theo dõi lượt xem, CTR nút bấm (CTA %) và lượng khách hàng tiềm năng thu về từ video ngắn trên TikTok, YouTube Shorts và X.'
              : 'Track real-time views, CTA click-through rate (CTR %), and leads captured per video across TikTok, YouTube Shorts, and X.'}
          </p>
        </div>

        <button
          onClick={() => {
            setIsGeneratorOpen(true);
            if (generatedHooks.length === 0) handleGenerateHooks();
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02]"
        >
          <Sparkles className="w-4 h-4" />
          {isVi ? 'Tạo Hook & Kịch Bản Mới' : 'Create Viral Hook & Script'}
        </button>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Views */}
        <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">
              {isVi ? 'Tổng Lượt Xem' : 'Total Views'}
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {initialOverview.totalViews.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> +18.4%
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {isVi ? `Trên ${initialOverview.totalVideos} video đã đăng` : `Across ${initialOverview.totalVideos} published videos`}
          </p>
        </div>

        {/* Total CTA Clicks & Avg CTR */}
        <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">
              {isVi ? 'Lượt Bấm Nút CTA (CTR)' : 'CTA Clicks (CTR %)'}
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <MousePointerClick className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {initialOverview.totalCtaClicks.toLocaleString()}
            </span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
              {initialOverview.averageCtrPct}% CTR
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {isVi ? 'Lượng truy cập phễu đăng ký' : 'Funnel traffic into landing/bot'}
          </p>
        </div>

        {/* Total Leads Generated */}
        <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">
              {isVi ? 'Leads Đã Thu Thập' : 'Leads Captured'}
            </span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {initialOverview.totalLeads.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-purple-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" /> 8.6% cvr
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {isVi ? 'Qua bot Telegram & web' : 'Via Telegram bot & web'}
          </p>
        </div>

        {/* Revenue Attributed */}
        <div className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">
              {isVi ? 'Doanh Thu Chuyển Đổi' : 'Revenue Generated'}
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              ${initialOverview.totalRevenueUsd.toLocaleString()}
            </span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              {initialOverview.totalConversions} {isVi ? 'khách' : 'paid'}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {isVi ? 'Mục tiêu: $5,000 MRR' : 'Target: $5,000 MRR'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
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

      {/* Video Funnel Performance Table */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-300">
            <thead className="text-xs uppercase bg-neutral-950/80 text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3.5 font-semibold">{isVi ? 'Video & Tiêu Đề' : 'Video & Title'}</th>
                <th className="px-4 py-3.5 font-semibold">{isVi ? 'Lĩnh Vực' : 'Niche'}</th>
                <th className="px-4 py-3.5 font-semibold">{isVi ? 'Nền Tảng' : 'Platform'}</th>
                <th className="px-4 py-3.5 font-semibold">{isVi ? 'Loại Hook' : 'Hook Type'}</th>
                <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Lượt Xem' : 'Views'}</th>
                <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Clicks CTA' : 'Clicks'}</th>
                <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Tỷ Lệ CTR' : 'CTR %'}</th>
                <th className="px-4 py-3.5 font-semibold text-right">{isVi ? 'Leads' : 'Leads'}</th>
                <th className="px-4 py-3.5 font-semibold text-center">{isVi ? 'Trạng Thái' : 'Status'}</th>
                <th className="px-4 py-3.5 font-semibold text-center">{isVi ? 'Hành Động' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-neutral-500">
                    {isVi ? 'Không tìm thấy video nào phù hợp.' : 'No videos found matching filters.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const trackingUrl = buildFunnelTrackingUrl({
                    platform: item.platform === 'all' ? 'tiktok' : item.platform,
                    niche: item.niche,
                    hookArchetype: item.hookArchetype,
                    videoId: item.videoId,
                  });
                  const deepLink = buildTelegramDeepLink({
                    videoId: item.videoId,
                    platform: item.platform === 'all' ? 'tiktok' : item.platform,
                    niche: item.niche,
                  });

                  return (
                    <tr
                      key={item.videoId}
                      className="hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-white flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0 text-neutral-400 border border-neutral-700">
                          <Video className="w-4 h-4" />
                        </div>
                        <span className="truncate max-w-[180px] sm:max-w-[240px]">
                          {item.videoTitle}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getNicheBadge(item.niche)}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getPlatformBadge(item.platform)}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-neutral-400">
                        {item.hookArchetype.replace('_', ' ')}
                      </td>

                      <td className="px-4 py-3.5 text-right font-medium whitespace-nowrap">
                        {item.views.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-right font-medium whitespace-nowrap text-blue-400">
                        {item.ctaClicks.toLocaleString()}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            item.ctrPct >= 5.0
                              ? 'text-emerald-400'
                              : item.ctrPct >= 3.0
                                ? 'text-blue-400'
                                : 'text-amber-400'
                          }`}
                        >
                          {item.ctrPct}%
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-semibold text-purple-400 whitespace-nowrap">
                        {item.leadsCount}
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {item.status === 'viral' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Flame className="w-3 h-3 text-emerald-400" /> Viral
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-400">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            title={isVi ? 'Sao chép link UTM tracking' : 'Copy UTM tracking link'}
                            onClick={() => copyToClipboard(trackingUrl, `utm_${item.videoId}`)}
                            className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                          >
                            {copiedKey === `utm_${item.videoId}` ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            title={isVi ? 'Sao chép deep link Telegram' : 'Copy Telegram deep link'}
                            onClick={() => copyToClipboard(deepLink, `tg_${item.videoId}`)}
                            className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-sky-400 transition-colors"
                          >
                            {copiedKey === `tg_${item.videoId}` ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Action Drawer: Hook & Script Studio */}
      {isGeneratorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">
                  {isVi ? 'Trợ Lý Tạo Hook & Kịch Bản Viral' : 'Viral Hook & Script Studio'}
                </h2>
              </div>
              <button
                onClick={() => setIsGeneratorOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>

            {/* Generator Form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                  {isVi ? 'Lĩnh Vực Mục Tiêu' : 'Target Niche'}
                </label>
                <select
                  value={genNiche}
                  onChange={(e) => setGenNiche(e.target.value as ViralNiche)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ai_automation">{isVi ? 'Tự Động Hóa AI' : 'AI Automation'}</option>
                  <option value="ecommerce">{isVi ? 'Thương Mại Điện Tử' : 'E-commerce'}</option>
                  <option value="solopreneur">{isVi ? 'Kinh Doanh Độc Lập' : 'Solopreneur'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                  {isVi ? 'Loại Hook (Tâm Lý)' : 'Hook Archetype'}
                </label>
                <select
                  value={genArchetype}
                  onChange={(e) => setGenArchetype(e.target.value as HookArchetype)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="curiosity_gap">{isVi ? 'Khoảng Trống Tò Mò' : 'Curiosity Gap'}</option>
                  <option value="shock_stat">{isVi ? 'Số Liệu Gây Sốc' : 'Shocking Stat'}</option>
                  <option value="direct_question">{isVi ? 'Câu Hỏi Trực Diện' : 'Direct Question'}</option>
                  <option value="problem_solution">{isVi ? 'Đảo Ngược Vấn Đề' : 'Problem-Solution'}</option>
                  <option value="contrarian">{isVi ? 'Quan Điểm Ngược Dòng' : 'Contrarian'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                  {isVi ? 'Chủ Đề Hoặc Ưu Đãi' : 'Custom Topic / Offer'}
                </label>
                <input
                  type="text"
                  placeholder={isVi ? 'Ví dụ: Khóa học AI 1 người...' : 'e.g. 1-person AI stack...'}
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleGenerateHooks}
                disabled={isGenerating}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
              >
                {isGenerating
                  ? isVi ? 'Đang Tạo...' : 'Generating...'
                  : isVi ? 'Tạo Biến Thể Hook' : 'Generate Hook Variants'}
              </button>
            </div>

            {/* Generated Hooks Carousel / List */}
            {generatedHooks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  {isVi ? 'Biến Thể Mở Đầu Đề Xuất (Bấm Để Chọn):' : 'Recommended Opening Hooks (Tap to Select):'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {generatedHooks.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => handleSelectHook(h)}
                      className={`text-left p-3.5 rounded-xl border transition-all ${
                        selectedHook?.id === h.id
                          ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500'
                          : 'border-neutral-800 bg-neutral-800/40 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          {h.archetype.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400">
                          {h.expectedRetentionScore}% {isVi ? 'Giữ Chân' : 'Retention'}
                        </span>
                      </div>
                      <p className="text-xs text-white font-medium">
                        {isVi ? h.hookTextVi : h.hookText}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Script Breakdown */}
            {activeScript && (
              <div className="space-y-3 border-t border-neutral-800 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    {isVi ? `Kịch Bản Hoàn Chỉnh (${activeScript.targetDurationSec} Giây):` : `Complete Script (${activeScript.targetDurationSec}s):`}
                  </h3>
                  <span className="text-xs text-neutral-500">
                    {isVi ? activeScript.titleVi : activeScript.title}
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activeScript.sections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-neutral-800/60 border border-neutral-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-neutral-400">
                        <span className="font-semibold uppercase text-emerald-400">
                          {idx + 1}. {sec.section.toUpperCase()} ({sec.durationSec}s)
                        </span>
                        <span className="text-[10px] text-neutral-500 italic">
                          Visual: {sec.visualCue}
                        </span>
                      </div>
                      <p className="text-white font-medium">
                        {isVi ? sec.narrationVi : sec.narration}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Funnel Link Injection Preview */}
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-400">
                      {isVi ? 'Link Funnel Tự Động Gắn Mã:' : 'Injected Tracking Links:'}
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(activeScript.ctaActionUrl, 'active_script_url')
                      }
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      {copiedKey === 'active_script_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {isVi ? 'Sao Chép' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono truncate">
                    {activeScript.ctaActionUrl}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
