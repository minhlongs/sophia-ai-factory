'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import DOMPurify from 'dompurify';
import { AlertCircle, Send, Copy, Check, Mail } from 'lucide-react';
import { newsletterGenerateAction } from '@/app/actions/newsletter-generate-action';
import type { Tier } from '@/seed/types';

interface NewsletterWriterTabProps {
  tier: Tier;
}

const TONE_OPTIONS = [
  { value: 'conversational', label: 'Conversational' },
  { value: 'professional', label: 'Professional' },
  { value: 'educational', label: 'Educational' },
  { value: 'witty', label: 'Witty' },
] as const;

export function NewsletterWriterTab({ tier: _tier }: NewsletterWriterTabProps) {
  const t = useTranslations('creativeStudio.newsletter');

  const [brandName, setBrandName] = useState('');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<'professional' | 'conversational' | 'educational' | 'witty'>('conversational');
  const [editorIntro, setEditorIntro] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    subject: string;
    html: string;
    plainText: string;
    wordCount: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = brandName.trim().length > 0 && topic.trim().length > 0 && !isGenerating;

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await newsletterGenerateAction({
        brandName: brandName.trim(),
        topic: topic.trim(),
        tone,
        editorIntro: editorIntro.trim() || undefined,
        ctaText: ctaText.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      setResult({
        subject: res.subject,
        html: res.html,
        plainText: res.plainText,
        wordCount: res.wordCount,
      });
    } catch {
      setError('Failed to generate newsletter');
    } finally {
      setIsGenerating(false);
    }
  }, [canSubmit, brandName, topic, tone, editorIntro, ctaText]);

  const sanitizedHtml = useMemo(
    () => result ? DOMPurify.sanitize(result.html) : '',
    [result],
  );

  const handleCopyHtml = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.html).catch(() => {
      /* clipboard unavailable — fail silently */
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
      {/* Left: Form */}
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('brandLabel')}
          </label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder={t('brandPlaceholder')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('topicLabel')}
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('topicPlaceholder')}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('toneLabel')}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTone(opt.value)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  tone === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('introLabel')}
          </label>
          <textarea
            value={editorIntro}
            onChange={(e) => setEditorIntro(e.target.value)}
            placeholder={t('introPlaceholder')}
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {t('ctaLabel')}
          </label>
          <input
            type="text"
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder={t('ctaPlaceholder')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleGenerate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {isGenerating ? t('generating') : t('generate')}
        </button>
      </div>

      {/* Right: Preview */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Mail className="h-4 w-4 text-primary" />
            {t('previewLabel')}
          </h3>
          {result && (
            <button
              type="button"
              onClick={handleCopyHtml}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t('copied') : t('copyHtml')}
            </button>
          )}
        </div>

        {result ? (
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">{t('subjectLine')}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{result.subject}</p>
            </div>
            <div
              className="newsletter-preview rounded-lg border border-border bg-white p-4 text-sm text-gray-800 dark:bg-gray-50"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
            <p className="text-xs text-muted-foreground">
              {result.wordCount} {t('words')}
            </p>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">{t('previewPlaceholder')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
