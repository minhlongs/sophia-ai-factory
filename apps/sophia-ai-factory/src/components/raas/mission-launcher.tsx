'use client';

/**
 * Mission Launcher
 *
 * Modal for creating new missions from templates.
 * Checks MCU balance against tier limit from config/tiers.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface TemplateParam {
  key: string;
  label: string;
  placeholder: string;
}

interface Template {
  id: string;
  name: string;
  icon: string;
  mcu: number;
  description: string;
  params: TemplateParam[];
}

const TEMPLATES: Template[] = [
  { id: 'proposal:create', name: 'Proposal', icon: 'description', mcu: 25, description: 'AI-written sales proposal', params: [{ key: 'company', label: 'Company Name', placeholder: 'Acme Corp' }, { key: 'goal', label: 'Goal', placeholder: 'Increase revenue by 30%' }] },
  { id: 'content:blog', name: 'Blog Post', icon: 'article', mcu: 50, description: 'SEO-optimized blog article', params: [{ key: 'topic', label: 'Topic', placeholder: 'AI automation for agencies' }] },
  { id: 'content:social', name: 'Social Bundle', icon: 'share', mcu: 10, description: 'LinkedIn + Twitter + TikTok', params: [{ key: 'topic', label: 'Topic', placeholder: 'Product launch announcement' }] },
  { id: 'video:create', name: 'Intro Video', icon: 'play_circle', mcu: 100, description: '30s HeyGen intro video', params: [{ key: 'script', label: 'Key Message', placeholder: 'What should the video convey?' }] },
  { id: 'sales:proposal-deck', name: 'Sales Deck', icon: 'slideshow', mcu: 10, description: 'Full proposal deck with slides', params: [{ key: 'client_name', label: 'Client Name', placeholder: 'Acme Corp' }, { key: 'industry', label: 'Industry', placeholder: 'Digital Agency' }] },
  { id: 'sales:roi-calculator', name: 'ROI Calculator', icon: 'calculate', mcu: 5, description: 'ROI projection for prospects', params: [{ key: 'proposals_per_month', label: 'Proposals/Month', placeholder: '20' }, { key: 'avg_deal_size', label: 'Avg Deal ($)', placeholder: '5000' }] },
  { id: 'sales:competitor-analysis', name: 'Competitor Intel', icon: 'query_stats', mcu: 8, description: 'SWOT analysis + win strategy', params: [{ key: 'competitors', label: 'Competitors (comma-sep)', placeholder: 'Proposify, PandaDoc' }] },
  { id: 'sales:outreach-sequence', name: 'Outreach Sequence', icon: 'forward_to_inbox', mcu: 8, description: 'Email + LinkedIn outreach', params: [{ key: 'prospect_company', label: 'Company', placeholder: 'Target Corp' }, { key: 'prospect_name', label: 'Contact', placeholder: 'John Doe' }] },
  { id: 'lead:generate', name: 'Lead Gen', icon: 'group_add', mcu: 30, description: 'Generate qualified leads list', params: [{ key: 'industry', label: 'Industry', placeholder: 'SaaS companies' }, { key: 'location', label: 'Location', placeholder: 'United States' }] },
];

interface Props {
  balance?: number;
  onClose: () => void;
  onSuccess?: (missionId: string) => void;
}

export function MissionLauncher({ balance = 0, onClose, onSuccess }: Props) {
  const t = useTranslations('dashboard.missions');
  const [selected, setSelected] = useState<Template | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const insufficient = selected ? balance < selected.mcu : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || insufficient) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/raas/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${selected.name} — ${new Date().toLocaleDateString()}`,
          command: selected.id,
          params,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const data = await res.json();
      onSuccess?.(data.mission?.id ?? data.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{t('launch_mission')}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {!selected ? (
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TEMPLATES.map(tp => (
              <button key={tp.id} onClick={() => { setSelected(tp); setParams({}); }}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 text-left transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-primary text-2xl">{tp.icon}</span>
                <span className="text-sm font-semibold text-foreground">{tp.name}</span>
                <span className="text-xs text-muted-foreground">{tp.description}</span>
                <span className="text-xs font-medium text-primary">{tp.mcu} MCU</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <button type="button" onClick={() => setSelected(null)} className="text-sm text-primary hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> {t('back_to_templates')}
            </button>

            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
              <span className="material-symbols-outlined text-primary text-2xl">{selected.icon}</span>
              <div>
                <p className="font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.description}</p>
              </div>
              <span className="ml-auto text-sm font-bold text-primary">{selected.mcu} MCU</span>
            </div>

            {selected.params.map(p => (
              <div key={p.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{p.label}</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={p.placeholder}
                  value={params[p.key] || ''}
                  onChange={e => setParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                  required
                />
              </div>
            ))}

            <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
              <span>{t('balance')}: <strong className={insufficient ? 'text-destructive' : 'text-foreground'}>{balance} MCU</strong></span>
              <span>{t('cost')}: <strong>{selected.mcu} MCU</strong></span>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {insufficient ? (
              <Link href="/dashboard/billing"
                className="block w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-center font-semibold hover:bg-primary/90 transition-colors">
                {t('insufficient_credits')}
              </Link>
            ) : (
              <button type="submit" disabled={submitting}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {submitting ? t('launching') : t('launch_mission')}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
