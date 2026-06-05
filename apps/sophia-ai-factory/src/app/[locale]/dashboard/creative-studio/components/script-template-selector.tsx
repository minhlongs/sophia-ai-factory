'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search,
  Filter,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle,
 X,
 ChevronUp,
 ChevronDown,
} from 'lucide-react';
import { CAMPAIGN_TEMPLATES } from '@/land/templates/campaign-templates';
import type { Tier } from '@/seed/types';
import { Button } from '@/seed/components/ui/button';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  defaults: {
    title: string;
    audience: string;
    tone: string;
    suggestedDuration: number;
  };
}

interface ScriptTemplateSelectorProps {
  tier: Tier;
  selectedTemplateId: string | null;
  topic: string;
  brandName: string;
  targetDuration: number;
  tone: string;
  language: 'en' | 'vi';
  onTemplateChange: (template: TemplateOption | null) => void;
  onTopicChange: (topic: string) => void;
  onBrandNameChange: (brand: string) => void;
  onDurationChange: (duration: number) => void;
  onToneChange: (tone: string) => void;
  onLanguageChange: (lang: 'en' | 'vi') => void;
  onGenerate: () => void;
  generating?: boolean;
  error?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Category labels (Vietnamese + English)                            */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, { vi: string; en: string }> = {
  welcome:     { vi: 'Chao don',     en: 'Welcome' },
  product:     { vi: 'San pham',    en: 'Product Launch' },
  seasonal:    { vi: 'Theo mua',    en: 'Seasonal' },
  promotion:   { vi: 'Khuyen mai',  en: 'Promotion' },
  viral:       { vi: 'Noi dung viral', en: 'Viral Content' },
};

type FilterCategory = 'all' | string;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ScriptTemplateSelector({
  tier,
  selectedTemplateId,
  topic,
  brandName,
  targetDuration,
  tone,
  language,
  onTemplateChange,
  onTopicChange,
  onBrandNameChange,
  onDurationChange,
  onToneChange,
  onLanguageChange,
  onGenerate,
  generating = false,
  error = null,
}: ScriptTemplateSelectorProps) {
  const t = useTranslations('creativeStudio');
  const locale = useLocale();
  const isVi = locale.startsWith('vi');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const templates = CAMPAIGN_TEMPLATES;

  /* Derive unique categories */
  const categories: { key: string; label: string }[] = [
    { key: 'all', label: isVi ? 'Tat ca' : 'All' },
    ...Object.entries(CATEGORY_LABELS).map(([key, labels]) => ({
      key,
      label: isVi ? labels.vi : labels.en,
    })),
  ];

  /* Filter templates */
  const filtered = templates.filter((tmpl) => {
    if (activeCategory !== 'all' && tmpl.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        tmpl.name.toLowerCase().includes(q) ||
        tmpl.description.toLowerCase().includes(q) ||
        tmpl.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedTemplate = selectedTemplateId
    ? templates.find((t) => t.id === selectedTemplateId) ?? null
    : null;

  /* Sync tone with selected template defaults */
  useEffect(() => {
    if (selectedTemplate && !tone) {
      onToneChange(selectedTemplate.defaults.tone);
    }
  }, [selectedTemplate]);

  const handleSelect = useCallback(
    (tmpl: TemplateOption) => {
      if (selectedTemplateId === tmpl.id) {
        onTemplateChange(null);
      } else {
        onTemplateChange(tmpl);
        if (!targetDuration) {
          onDurationChange(tmpl.defaults.suggestedDuration);
        }
        if (!tone) {
          onToneChange(tmpl.defaults.tone);
        }
      }
    },
    [selectedTemplateId, targetDuration, tone],
  );

  const canGenerate =
    selectedTemplateId !== null &&
    topic.trim().length >= 2 &&
    !generating;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Template grid ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Search + category filters */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isVi ? 'Tim kiem mau...' : 'Search templates...'}
              className="w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-violet-600 text-white'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 border border-white/10'
                }`}
              >
                {activeCategory === cat.key && <Filter className="h-3 w-3" />}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Template cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="col-span-full py-8 text-center text-zinc-500 text-sm">
              {isVi ? 'Khong tim thay mau phu hop' : 'No matching templates'}
            </div>
          ) : (
            filtered.map((tmpl) => {
              const isSelected = selectedTemplateId === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelect(tmpl)}
                  className={`text-left rounded-xl border p-4 transition-all group ${
                    isSelected
                      ? 'border-violet-500/60 bg-violet-500/10 shadow-lg shadow-violet-500/10'
                      : 'border-white/10 bg-zinc-900/30 hover:border-white/20 hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tmpl.icon}</span>
                      <div>
                        <p className={`text-sm font-semibold ${isSelected ? 'text-violet-200' : 'text-zinc-200'}`}>
                          {tmpl.name}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
                          {tmpl.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* Meta pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 border border-white/5">
                      {isVi ? (CATEGORY_LABELS[tmpl.category]?.vi ?? tmpl.category) : (CATEGORY_LABELS[tmpl.category]?.en ?? tmpl.category)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 border border-white/5 font-mono">
                      ~{tmpl.defaults.suggestedDuration}s
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500 border border-white/5">
                      {isVi ? 'Tu:' : 'Tone:'} {tmpl.defaults.tone}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Topic & brand inputs ──────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/30 p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            {isVi ? 'Chu de / Topic' : 'Topic'} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder={
              selectedTemplate
                ? isVi
                  ? `VD: ${selectedTemplate.defaults.title}...`
                  : `e.g. ${selectedTemplate.defaults.title}...`
                : isVi
                  ? 'Nhap chu de video cua ban...'
                  : 'Enter your video topic...'
            }
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            {isVi
              ? `Dien vao mau: ${selectedTemplate?.defaults.audience ?? ''}`
              : `Target: ${selectedTemplate?.defaults.audience ?? ''}`}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            {isVi ? 'Ten thuong hieu' : 'Brand Name'}
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => onBrandNameChange(e.target.value)}
            placeholder={isVi ? 'Ten thuong hieu / kenh cua ban...' : 'Your brand or channel name...'}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
          />
        </div>

        {/* Advanced toggles */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          {isVi ? 'Tuy chon nang cao' : 'Advanced options'}
          {showAdvanced ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                {isVi ? 'Thoi luong (giay)' : 'Duration (sec)'}
              </label>
              <input
                type="number"
                min={10}
                max={300}
                step={5}
                value={targetDuration}
                onChange={(e) => onDurationChange(parseInt(e.target.value, 10) || 30)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                {isVi ? 'Tong giong' : 'Tone'}
              </label>
              <input
                type="text"
                value={tone}
                onChange={(e) => onToneChange(e.target.value)}
                placeholder={isVi ? 'VD: chuyen nghiep, than thien...' : 'e.g. professional, casual...'}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                {isVi ? 'Ngon ngu' : 'Language'}
              </label>
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as 'en' | 'vi')}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
              >
                <option value="vi">Tieng Viet</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-200">{error}</p>
        </div>
      )}

      {/* Generate button */}
      <Button
        size="lg"
        disabled={!canGenerate}
        onClick={onGenerate}
        className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isVi ? 'Dang tao kich ban...' : 'Generating script...'}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            {isVi ? 'Tao kich ban' : 'Generate Script'}
          </>
        )}
      </Button>
    </div>
  );
}
