'use client';

/**
 * Viral Funnel Dashboard Composed View
 *
 * Real-time performance dashboard for viral short-form video lead generation
 * across TikTok, YouTube Shorts, and X (Twitter).
 *
 * Layer: Forest (UI components & coordinators)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/viral-funnel/viral-funnel-view
 */

import React, { useState, useMemo } from 'react';
import { Sparkles, Flame } from 'lucide-react';
import type {
  ViralNiche,
  HookArchetype,
  ViralPlatform,
  ViralHook,
  ViralScript,
} from '@/seed/types/growth';
import { generateViralHooks, generateViralScript } from '@/tree/viral/hook-generator';
import type { ViralFunnelViewProps } from './types';
import { FunnelKpiCards } from './funnel-kpi-cards';
import { FunnelFilterBar } from './funnel-filter-bar';
import { FunnelTable } from './funnel-table';
import { HookGeneratorModal } from './hook-generator-modal';

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
      <FunnelKpiCards overview={initialOverview} isVi={isVi} />

      {/* Filter and Search Bar */}
      <FunnelFilterBar
        selectedNiche={selectedNiche}
        setSelectedNiche={setSelectedNiche}
        selectedPlatform={selectedPlatform}
        setSelectedPlatform={setSelectedPlatform}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isVi={isVi}
      />

      {/* Video Funnel Performance Table */}
      <FunnelTable
        items={filteredItems}
        isVi={isVi}
        copiedKey={copiedKey}
        copyToClipboard={copyToClipboard}
      />

      {/* Quick Action Drawer: Hook & Script Studio */}
      <HookGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        isVi={isVi}
        genNiche={genNiche}
        setGenNiche={setGenNiche}
        genArchetype={genArchetype}
        setGenArchetype={setGenArchetype}
        genTopic={genTopic}
        setGenTopic={setGenTopic}
        generatedHooks={generatedHooks}
        selectedHook={selectedHook}
        activeScript={activeScript}
        isGenerating={isGenerating}
        handleGenerateHooks={handleGenerateHooks}
        handleSelectHook={handleSelectHook}
        copyToClipboard={copyToClipboard}
        copiedKey={copiedKey}
      />
    </div>
  );
}
