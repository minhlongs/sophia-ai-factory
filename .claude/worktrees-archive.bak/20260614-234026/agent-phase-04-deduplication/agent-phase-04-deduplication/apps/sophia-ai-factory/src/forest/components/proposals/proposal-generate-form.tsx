'use client';

/**
 * Proposal Generate Form
 *
 * Form fields for AI proposal generation.
 * Extracted from ai-generate-form.tsx (sophia-proposal) to stay under 200 lines.
 */

import { useTranslations } from 'next-intl';

export interface ProposalFormData {
  clientName: string;
  clientCompany: string;
  industry: string;
  painPoints: string;
  goals: string;
  solutionDescription: string;
  timeline: string;
  investment: string;
  deliverables: string;
  tone: 'professional' | 'friendly' | 'technical';
  length: 'short' | 'medium' | 'long';
}

interface Props {
  values: ProposalFormData;
  onChange: (field: keyof ProposalFormData, value: string) => void;
}

const inputClass =
  'mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export function ProposalGenerateForm({ values, onChange }: Props) {
  const t = useTranslations('dashboard.proposals');

  return (
    <div className="space-y-5">
      {/* Client info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">{t('client_name')}</label>
          <input type="text" required className={inputClass}
            value={values.clientName} onChange={e => onChange('clientName', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t('client_company')}</label>
          <input type="text" required className={inputClass}
            value={values.clientCompany} onChange={e => onChange('clientCompany', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">{t('industry')}</label>
        <input type="text" required className={inputClass}
          value={values.industry} onChange={e => onChange('industry', e.target.value)}
          placeholder={t('industry_placeholder')} />
      </div>

      {/* Pain points */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t('pain_points')}</label>
        <textarea rows={3} required className={inputClass}
          value={values.painPoints} onChange={e => onChange('painPoints', e.target.value)}
          placeholder={t('pain_points_placeholder')} />
      </div>

      {/* Goals */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t('goals')}</label>
        <textarea rows={3} required className={inputClass}
          value={values.goals} onChange={e => onChange('goals', e.target.value)}
          placeholder={t('goals_placeholder')} />
      </div>

      {/* Solution */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t('solution')}</label>
        <textarea rows={3} required className={inputClass}
          value={values.solutionDescription} onChange={e => onChange('solutionDescription', e.target.value)} />
      </div>

      {/* Timeline + Investment */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">{t('timeline')}</label>
          <input type="text" required className={inputClass}
            value={values.timeline} onChange={e => onChange('timeline', e.target.value)}
            placeholder="8 weeks" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t('investment')}</label>
          <input type="text" required className={inputClass}
            value={values.investment} onChange={e => onChange('investment', e.target.value)}
            placeholder="$10,000 - $15,000" />
        </div>
      </div>

      {/* Deliverables */}
      <div>
        <label className="block text-sm font-medium text-foreground">{t('deliverables')}</label>
        <textarea rows={3} required className={inputClass}
          value={values.deliverables} onChange={e => onChange('deliverables', e.target.value)}
          placeholder={t('deliverables_placeholder')} />
      </div>

      {/* Tone + Length */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground">{t('tone')}</label>
          <select className={inputClass}
            value={values.tone} onChange={e => onChange('tone', e.target.value)}>
            <option value="professional">{t('tone_professional')}</option>
            <option value="friendly">{t('tone_friendly')}</option>
            <option value="technical">{t('tone_technical')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t('length')}</label>
          <select className={inputClass}
            value={values.length} onChange={e => onChange('length', e.target.value)}>
            <option value="short">{t('length_short')}</option>
            <option value="medium">{t('length_medium')}</option>
            <option value="long">{t('length_long')}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
