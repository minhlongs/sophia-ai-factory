/**
 * Proposals Dashboard Page
 *
 * Proposal generator: form + actions on left, editor on right.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ProposalGenerateForm, type ProposalFormData } from '@/forest/components/proposals/proposal-generate-form';
import { ProposalGenerateActions } from '@/forest/components/proposals/proposal-generate-actions';
import { ProposalEditor } from '@/forest/components/proposals/proposal-editor';

const INITIAL_FORM: ProposalFormData = {
  clientName: '',
  clientCompany: '',
  industry: '',
  painPoints: '',
  goals: '',
  solutionDescription: '',
  timeline: '',
  investment: '',
  deliverables: '',
  tone: 'professional',
  length: 'medium',
};

interface QualityResult {
  score: number;
  passed: boolean;
}

interface ProposalApiResponse {
  error?: string;
  quality?: { score?: number; passed?: boolean };
  proposal?: Record<string, string>;
}

export default function ProposalsPage() {
  const t = useTranslations('dashboard.proposals');
  const [formData, setFormData] = useState<ProposalFormData>(INITIAL_FORM);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleFieldChange(field: keyof ProposalFormData, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function handleGenerate(data: ProposalFormData) {
    setIsGenerating(true);
    setQuality(null);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          painPoints: data.painPoints.split('\n').filter(Boolean),
          goals: data.goals.split('\n').filter(Boolean),
          deliverables: data.deliverables.split('\n').filter(Boolean),
        }),
      });
      const result = (await res.json().catch(() => ({}))) as ProposalApiResponse;
      if (!res.ok) throw new Error(result.error || `Request failed (${res.status})`);
      setQuality({ score: result.quality?.score ?? 80, passed: result.quality?.passed ?? true });
      setGeneratedContent(result.proposal ?? {});
    } catch (err) {
      setQuality({ score: 0, passed: false });
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSave(content: Record<string, string>) {
    // Could persist to Supabase here
    setGeneratedContent(content);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('page_title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('page_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: form + actions */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">{t('form_title')}</h2>
            <ProposalGenerateForm values={formData} onChange={handleFieldChange} />
          </div>
          <ProposalGenerateActions
            formData={formData}
            isGenerating={isGenerating}
            quality={quality}
            onGenerate={handleGenerate}
          />
          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <p className="font-medium">Failed to generate proposal</p>
              <p className="mt-1 text-xs opacity-90">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Right: editor */}
        <div className="bg-card rounded-xl border border-border p-5">
          <ProposalEditor
            initialContent={generatedContent ?? {}}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
}
