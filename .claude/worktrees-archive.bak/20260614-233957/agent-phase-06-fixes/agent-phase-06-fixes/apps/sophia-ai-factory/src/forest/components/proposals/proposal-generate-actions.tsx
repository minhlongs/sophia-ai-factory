'use client';

/**
 * Proposal Generate Actions
 *
 * Submit + quality score display for proposal generation.
 * Companion to ProposalGenerateForm.
 */

import { useTranslations } from 'next-intl';
import type { ProposalFormData } from './proposal-generate-form';

interface QualityResult {
  score: number;
  passed: boolean;
}

interface Props {
  formData: ProposalFormData;
  isGenerating: boolean;
  quality: QualityResult | null;
  onGenerate: (data: ProposalFormData) => Promise<void>;
  onPreview?: () => void;
}

export function ProposalGenerateActions({ formData, isGenerating, quality, onGenerate, onPreview }: Props) {
  const t = useTranslations('dashboard.proposals');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onGenerate(formData);
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          form="proposal-form"
          onClick={handleSubmit}
          disabled={isGenerating}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <>
              <span className="material-symbols-outlined motion-safe:animate-spin text-base">progress_activity</span>
              {t('generating')}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              {t('generate')}
            </>
          )}
        </button>

        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="px-4 py-3 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {t('preview')}
          </button>
        )}
      </div>

      {/* Quality result */}
      {quality && (
        <div className={`p-4 rounded-lg border ${
          quality.passed
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
            : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-lg ${quality.passed ? 'text-green-600' : 'text-yellow-600'}`}>
              {quality.passed ? 'check_circle' : 'warning'}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('quality_score')}: {quality.score}/100
              </p>
              <p className="text-xs text-muted-foreground">
                {quality.passed ? t('quality_passed') : t('quality_review')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
