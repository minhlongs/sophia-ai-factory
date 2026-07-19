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
/* Types */
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
/* Component */
/* ------------------------------------------------------------------ */

const CATEGORY_KEYS = ['welcome', 'product', 'seasonal', 'promotion', 'viral'] as const;

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
  const t = useTranslations('creativeStudio.templateSelector');
  const locale = useLocale();
  const isVi = locale.startsWith('vi');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const templates = CAMPAIGN_TEMPLATES;

  /* Derive unique categories */
  const categories: { key: string; label: string }[] = [
    { key: 'all', label: t('filter_all') },
    ...CATEGORY_KEYS.map((key) => ({
      key,
      label: t(`category_${key}`),
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

  const canGenerate = selectedTemplateId !== null && topic.trim().length >= 2 && !generating;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Template grid ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Search + category filters */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary transition"
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
                    ? 'bg-primary-600 text-white'
                    : 'bg-white/5 text-muted-foreground-400 hover:bg-white/10 border border-white/10'
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
            <div className="col-span-full py-8 text-center text-muted-foreground-500 text-sm">
              {t('no_templates')}
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
                      ? 'border-primary/60 bg-primary/10 shadow-lg shadow-primary/20'
                      : 'border-white/10 bg-muted-900/30 hover:border-white/20 hover:bg-muted-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tmpl.icon}</span>
                      <div>
                        <p className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {tmpl.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground-500 mt-0.5 line-clamp-2">
                          {tmpl.description}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-4 w-4 text-primary-400 flex-shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* Meta pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground-500 border border-white/5">
                      {t(`category_${tmpl.category}`)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground-500 border border-white/5 font-mono">
                      ~{tmpl.defaults.suggestedDuration}s
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground-500 border border-white/5">
                      {t('tone_label')} {tmpl.defaults.tone}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Topic & brand inputs ──────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-muted-900/30 p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground-400 mb-1.5">
            {t('topic_label')} <span className="text-red-400">{t('topic_required')}</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder={
              selectedTemplate
                ? t('topic_placeholder_template', { title: selectedTemplate.defaults.title })
                : t('topic_placeholder_default')
            }
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
          <p className="text-[10px] text-muted-foreground-600 mt-1">
            {selectedTemplate
              ? t('topic_hint_template', { audience: selectedTemplate.defaults.audience })
              : ''}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground-400 mb-1.5">
            {t('brand_label')}
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => onBrandNameChange(e.target.value)}
            placeholder={t('brand_placeholder')}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary transition"
          />
        </div>

        {/* Advanced toggles */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          {t('advanced_options')}
          {showAdvanced ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground-500 mb-1">
                {t('duration_label')}
              </label>
              <input
                type="number"
                min={10}
                max={300}
                step={5}
                value={targetDuration}
                onChange={(e) => onDurationChange(parseInt(e.target.value, 10) || 30)}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground-500 mb-1">
                {t('tone_label')}
              </label>
              <input
                type="text"
                value={tone}
                onChange={(e) => onToneChange(e.target.value)}
                placeholder={t('tone_placeholder')}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground-500 mb-1">
                {t('language_label')}
              </label>
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as 'en' | 'vi')}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary transition"
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
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-xs text-destructive/80">{error}</p>
        </div>
      )}

      {/* Generate button */}
      <Button
        size="lg"
        disabled={!canGenerate}
        onClick={onGenerate}
        className="w-full bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-foreground font-bold"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('generating')}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            {t('generate')}
          </>
        )}
      </Button>
    </div>
  );
}
