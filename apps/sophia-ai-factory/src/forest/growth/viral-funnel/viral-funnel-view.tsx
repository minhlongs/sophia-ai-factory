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
import { ViralFunnelHeader } from './viral-funnel-header';

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

  const handleGenerateHooks = async () => {
    setIsGenerating(true);
    try {
      const hooks = await generateViralHooks({ niche: genNiche, archetype: genArchetype, customTopic: genTopic, count: 4 });
      setGeneratedHooks(hooks);
      if (hooks.length > 0) {
        setSelectedHook(hooks[0]);
        setActiveScript(await generateViralScript({ niche: genNiche, hook: hooks[0], targetDurationSec: 30 }));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectHook = async (hook: ViralHook) => {
    setSelectedHook(hook);
    setIsGenerating(true);
    try {
      setActiveScript(await generateViralScript({ niche: genNiche, hook, targetDurationSec: 30 }));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <ViralFunnelHeader
        isVi={isVi}
        onOpenGenerator={() => {
          setIsGeneratorOpen(true);
          if (generatedHooks.length === 0) void handleGenerateHooks();
        }}
      />

      <FunnelKpiCards overview={initialOverview} isVi={isVi} />
      <FunnelFilterBar
        selectedNiche={selectedNiche} setSelectedNiche={setSelectedNiche}
        selectedPlatform={selectedPlatform} setSelectedPlatform={setSelectedPlatform}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery} isVi={isVi}
      />
      <FunnelTable items={filteredItems} isVi={isVi} copiedKey={copiedKey} copyToClipboard={copyToClipboard} />
      <HookGeneratorModal
        isOpen={isGeneratorOpen} onClose={() => setIsGeneratorOpen(false)} isVi={isVi}
        genNiche={genNiche} setGenNiche={setGenNiche} genArchetype={genArchetype} setGenArchetype={setGenArchetype}
        genTopic={genTopic} setGenTopic={setGenTopic} generatedHooks={generatedHooks} selectedHook={selectedHook}
        activeScript={activeScript} isGenerating={isGenerating}
        handleGenerateHooks={handleGenerateHooks} handleSelectHook={handleSelectHook}
        copyToClipboard={copyToClipboard} copiedKey={copiedKey}
      />
    </div>
  );
}
