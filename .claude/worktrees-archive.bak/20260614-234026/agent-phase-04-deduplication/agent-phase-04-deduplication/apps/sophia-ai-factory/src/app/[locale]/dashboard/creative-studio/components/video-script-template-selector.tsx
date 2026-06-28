'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search, Filter, Sparkles, CheckCircle2, Loader2, AlertCircle, ChevronUp, ChevronDown, Wand2 } from 'lucide-react';
import { CAMPAIGN_TEMPLATES } from '@/land/templates/campaign-templates';

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  defaults: { title: string; audience: string; tone: string; suggestedDuration: number };
}

interface VideoScriptTemplateSelectorProps {
  selectedTemplateId: string | null;
  topic: string;
  onSelect: (templateId: string, templateName: string) => void;
  onTopicChange: (topic: string) => void;
  onGenerate: () => void;
  generating?: boolean;
  error?: string | null;
}

/* ------------------------------------------------------------------ */
/* Category labels */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, { vi: string; en: string }> = {
  welcome: { vi: 'Chao don', en: 'Welcome' },
  product: { vi: 'San pham', en: 'Product Launch' },
  seasonal: { vi: 'Theo mua', en: 'Seasonal' },
  promotion: { vi: 'Khuyen mai', en: 'Promotion' },
  viral: { vi: 'Noi dung viral', en: 'Viral Content' },
};

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */

export function VideoScriptTemplateSelector({
  selectedTemplateId,
  topic,
  onSelect,
  onTopicChange,
  onGenerate,
  generating = false,
  error = null,
}: VideoScriptTemplateSelectorProps) {
  const t = useTranslations('creativeStudio');
  const locale = useLocale();
  const isVi = locale.startsWith('vi');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const templates = CAMPAIGN_TEMPLATES;

  /* Derive unique categories */
  const categories: { key: string; label: string }[] = [
    { key: 'all', label: isVi ? 'Tat ca' : 'All' },
    ...Object.entries(CATEGORY_LABELS).map(([key, labels]) => ({ key, label: isVi ? labels.vi : labels.en })),
  ];

  /* Filter templates */
  const filtered = templates.filter((tmpl) => {
    if (activeCategory !== 'all' && tmpl.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return tmpl.name.toLowerCase().includes(q) || tmpl.description.toLowerCase().includes(q) || tmpl.category.toLowerCase().includes(q);
    }
    return true;
  });

  const selectedTemplate = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) ?? null : null;

  const handleSelect = useCallback((tmpl: TemplateOption) => {
    if (selectedTemplateId === tmpl.id) {
      onSelect('', '');
    } else {
      onSelect(tmpl.id, tmpl.name);
    }
  }, [selectedTemplateId, onSelect]);

  const canGenerate = selectedTemplateId !== null && topic.trim().length >= 2 && !generating;

  return (
    <div className="flex flex-col gap-4">
      {/* Topic input */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="template-topic" className="text-xs font-medium text-muted-foreground-400">
          {isVi ? 'Chu de / Topic' : 'Topic'} <span className="text-red-400">*</span>
        </label>
        <input
          id="template-topic"
          type="text"
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder={selectedTemplate ? (isVi ? `VD: ${selectedTemplate.defaults.title}...` : `e.g. ${selectedTemplate.defaults.title}...`) : (isVi ? 'Nhap chu de video cua ban...' : 'Enter your video topic...')}
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
        />
        {selectedTemplate && (
          <p className="text-[10px] text-muted-foreground-600 mt-0.5">
            {isVi ? `Dien vao mau: ${selectedTemplate.defaults.audience}` : `Target: ${selectedTemplate.defaults.audience}`}
          </p>
        )}
      </div>

      {/* Search + category filters */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground-500" />
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
                activeCategory === cat.key ? 'bg-primary-600 text-white' : 'bg-white/5 text-muted-foreground-400 hover:bg-white/10 border border-white/10'
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
                  isSelected ? 'border-primary-500/60 bg-primary-500/10 shadow-lg shadow-violet-500/10' : 'border-white/10 bg-muted-900/30 hover:border-white/20 hover:bg-muted-900/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tmpl.icon}</span>
                    <div>
                      <p className={`text-sm font-semibold ${isSelected ? 'text-primary-200' : 'text-muted-foreground-200'}`}>{tmpl.name}</p>
                      <p className="text-[11px] text-muted-foreground-500 mt-0.5 line-clamp-2">{tmpl.description}</p>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-primary-400 flex-shrink-0 mt-0.5" />}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground-500 border border-white/5">
                    {isVi ? (CATEGORY_LABELS[tmpl.category]?.vi ?? tmpl.category) : (CATEGORY_LABELS[tmpl.category]?.en ?? tmpl.category)}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground-500 border border-white/5 font-mono">
                    ~{tmpl.defaults.suggestedDuration}s
                  </span>
                </div>
              </button>
            );
          })
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
      <button
        type="button"
        onClick={onGenerate}
        disabled={!canGenerate}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 text-sm font-semibold text-white hover:from-violet-500 hover:to-cyan-400 transition disabled:opacity-50"
      >
        {generating && <Loader2 className="h-4 w-4 animate-spin" />}
        {generating ? (isVi ? 'Dang tao kich ban...' : 'Generating script...') : (isVi ? 'Tao kich ban' : 'Generate Script')}
      </button>
    </div>
  );
}
