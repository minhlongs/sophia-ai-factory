'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Play,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/seed/components/ui/button';

import type { GeneratedScript, ScriptScene } from './script-types';

/* ------------------------------------------------------------------ */
/* Types (mirors API response — keep in sync with route.ts) */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Props */
/* ------------------------------------------------------------------ */

interface ScriptPreviewPanelProps {
  script: GeneratedScript | null;
  loading?: boolean;
  error?: string | null;
  onRegenerate?: () => void;
  onUseScript?: () => void;
  onEditScript?: () => void;
}

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

const TYPE_LABELS: Record<string, { vi: string; en: string; color: string }> = {
  intro: { vi: 'Mo dau', en: 'Intro', color: 'bg-primary/15 text-primary border-primary/30' },
  hook: { vi: 'Thu hut', en: 'Hook', color: 'bg-primary/15 text-primary border-primary/30' },
  body: { vi: 'Noi dung', en: 'Body', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  cta: { vi: 'Keu goi', en: 'CTA', color: 'bg-accent/15 text-accent border-accent/30' },
  outro: { vi: 'Ket thuc', en: 'Outro', color: 'bg-muted/15 text-muted-foreground border-muted/30' },
};

const TYPE_ICONS: Record<string, string> = {
  intro: '🎬',
  hook: '🎉',
  body: '📝',
  cta: '📣',
  outro: '👋',
};

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */

export function ScriptPreviewPanel({
  script,
  loading = false,
  error = null,
  onRegenerate,
  onUseScript,
  onEditScript,
}: ScriptPreviewPanelProps) {
  const t = useTranslations('creativeStudio');
  const locale = useLocale();
  const isVi = locale.startsWith('vi');
  const [copied, setCopied] = useState(false);
  const [showFullScript, setShowFullScript] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());

  const toggleScene = useCallback((id: number) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!script) return;
    setExpandedScenes(new Set(script.scenes.map((s) => s.id)));
  }, [script]);

  const collapseAll = useCallback(() => {
    setExpandedScenes(new Set());
  }, []);

  const handleCopy = useCallback(async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script.fullScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = script.fullScript;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [script]);

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl border border-border/50 bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{isVi ? 'Dang tao kich ban...' : 'Generating script...'}</p>
      </div>
    );
  }

  /* ---- Error state ---- */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl border border-destructive/20 bg-destructive/5">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive/80">{error}</p>
        {onRegenerate && (
          <Button variant="outline" size="sm" onClick={onRegenerate} className="mt-2">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {isVi ? 'Thu lai' : 'Retry'}
          </Button>
        )}
      </div>
    );
  }

  /* ---- Empty state ---- */
  if (!script) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl border border-border/10 bg-muted">
        <FileText className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{isVi ? 'Chon mau va tao kich ban de xem preview' : 'Select a template and generate to preview'}</p>
      </div>
    );
  }

  const totalDuration = script.totalDurationSec;
  const scenes = script.scenes;

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar */}
      <div className="rounded-xl border border-border/50 bg-muted p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {script.templateName}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground font-mono">
                {script.language === 'vi' ? 'VI' : 'EN'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground/90 mt-1 line-clamp-1">
              {isVi ? 'Chu de:' : 'Topic:'} {script.topic}
            </h3>
            {script.brandName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {isVi ? 'Thuong hieu:' : 'Brand:'} {script.brandName}
              </p>
            )}
          </div>

          {/* Duration badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold text-primary/80 font-mono">
              {fmtDuration(totalDuration)}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {isVi ? 'Tong giong:' : 'Tone:'} <span className="text-muted-foreground/80">{script.tone}</span>
          </span>
          <span>
            {isVi ? 'Tu:' : 'Words:'} <span className="text-muted-foreground/80 font-mono">{script.wordCount}</span>
          </span>
          <span>
            {isVi ? 'Canh:' : 'Scenes:'} <span className="text-muted-foreground/80 font-mono">{scenes.length}</span>
          </span>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/10">
          <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 px-2 text-xs">
            <ChevronDown className="h-3 w-3 mr-1" />
            {isVi ? 'Mo tat ca' : 'Expand all'}
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 px-2 text-xs">
            <ChevronUp className="h-3 w-3 mr-1" />
            {isVi ? 'Thu gon' : 'Collapse'}
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setShowFullScript((v) => !v)} className="h-7 px-2 text-xs">
            {showFullScript ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
            {showFullScript ? (isVi ? 'An ban day du' : 'Hide full script') : (isVi ? 'Xem ban day du' : 'View full script')}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
            {copied ? <Check className="h-3 w-3 mr-1 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? (isVi ? 'Da sao chep' : 'Copied!') : (isVi ? 'Sao chep' : 'Copy')}
          </Button>
          {onRegenerate && (
            <Button variant="ghost" size="sm" onClick={onRegenerate} className="h-7 px-2 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              {isVi ? 'Tao lai' : 'Regenerate'}
            </Button>
          )}
        </div>
      </div>

      {/* Full script view */}
      {showFullScript && (
        <div className="rounded-xl border border-border/50 bg-background p-4">
          <pre className="text-xs leading-relaxed text-muted-foreground/80 whitespace-pre-wrap font-mono">
            {script.fullScript}
          </pre>
        </div>
      )}

      {/* Scene cards */}
      <div className="flex flex-col gap-3">
        {scenes.map((scene, idx) => {
          const labels = TYPE_LABELS[scene.type] ?? TYPE_LABELS.intro;
          const isExpanded = expandedScenes.has(scene.id);

          return (
            <div
              key={scene.id}
              className="rounded-xl border border-border/50 bg-background/30 overflow-hidden transition-colors hover:border-border"
            >
              {/* Scene header — always visible */}
              <button
                type="button"
                onClick={() => toggleScene(scene.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-muted/10 transition-colors"
              >
                {/* Scene number */}
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-muted/20 text-xs font-bold text-muted-foreground font-mono">
                  {idx + 1}
                </span>

                {/* Type badge */}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${labels.color}`}
                >
                  <span>{TYPE_ICONS[scene.type] ?? '📄'}</span>
                  {isVi ? labels.vi : labels.en}
                </span>

                {/* Duration */}
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                  <Clock className="h-3 w-3" />
                  {fmtDuration(scene.durationSec)}
                </span>

                {/* Spacer + expand chevron */}
                <div className="flex-1" />
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Scene body — collapsible */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/10">
                  {/* Script text */}
                  <div className="pt-3">
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                      {isVi ? 'Noi dung:' : 'Script:'}
                    </p>
                    <p className="text-sm text-muted-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {scene.text}
                    </p>
                  </div>

                  {/* Visual hint */}
                  <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-3">
                    <Play className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">
                        {isVi ? 'Goi y hinh anh' : 'Visual Hint'}
                      </p>
                      <p className="text-xs text-muted-foreground">{scene.visualHint}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {onUseScript && (
          <Button size="sm" onClick={onUseScript} className="bg-primary hover:bg-primary/90 text-foreground">
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {isVi ? 'Su dung kich ban nay' : 'Use this script'}
          </Button>
        )}
        {onEditScript && (
          <Button variant="outline" size="sm" onClick={onEditScript}>
            {isVi ? 'Chinh sua' : 'Edit script'}
          </Button>
        )}
      </div>
    </div>
  );
}
