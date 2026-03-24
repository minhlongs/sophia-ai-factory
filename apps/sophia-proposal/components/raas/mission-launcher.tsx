'use client';

/**
 * Mission Launcher
 * Modal panel for creating new missions from templates.
 * Shows MCU cost, balance check, and insufficient credits CTA.
 */

import { useState } from 'react';

interface Template {
  id: string;
  name: string;
  icon: string;
  mcu: number;
  description: string;
  params: { key: string; label: string; placeholder: string }[];
}

const TEMPLATES: Template[] = [
  { id: 'proposal:text:advanced', name: 'Proposal', icon: 'description', mcu: 25, description: 'AI-written sales proposal', params: [{ key: 'company', label: 'Company Name', placeholder: 'Acme Corp' }, { key: 'goal', label: 'Goal', placeholder: 'Increase revenue by 30%' }] },
  { id: 'affiliate:blog', name: 'Blog Post', icon: 'article', mcu: 50, description: 'SEO-optimized blog article', params: [{ key: 'topic', label: 'Topic', placeholder: 'AI automation for agencies' }] },
  { id: 'affiliate:social', name: 'Social Bundle', icon: 'share', mcu: 10, description: 'LinkedIn + Twitter + TikTok', params: [{ key: 'topic', label: 'Topic', placeholder: 'Product launch announcement' }] },
  { id: 'video:intro', name: 'Intro Video', icon: 'play_circle', mcu: 100, description: '30s HeyGen intro video', params: [{ key: 'script', label: 'Key Message', placeholder: 'What should the video convey?' }] },
  { id: 'affiliate:video', name: 'Video Review', icon: 'video_library', mcu: 200, description: 'Full product video review', params: [{ key: 'product', label: 'Product', placeholder: 'Product name or URL' }] },
  { id: 'sales:proposal-deck', name: 'Sales Deck', icon: 'slideshow', mcu: 10, description: 'Full proposal deck with slides', params: [{ key: 'client_name', label: 'Client Name', placeholder: 'Acme Corp' }, { key: 'industry', label: 'Industry', placeholder: 'Digital Agency' }] },
  { id: 'sales:roi-calculator', name: 'ROI Calculator', icon: 'calculate', mcu: 5, description: 'ROI projection for prospects', params: [{ key: 'proposals_per_month', label: 'Proposals/Month', placeholder: '20' }, { key: 'avg_deal_size', label: 'Avg Deal Size ($)', placeholder: '5000' }] },
  { id: 'sales:competitor-analysis', name: 'Competitor Intel', icon: 'query_stats', mcu: 8, description: 'SWOT analysis + win strategy', params: [{ key: 'competitors', label: 'Competitors (comma-sep)', placeholder: 'Proposify, PandaDoc, Qwilr' }] },
  { id: 'sales:outreach-sequence', name: 'Outreach Sequence', icon: 'forward_to_inbox', mcu: 8, description: 'Email + LinkedIn outreach', params: [{ key: 'prospect_company', label: 'Company', placeholder: 'Target Corp' }, { key: 'prospect_name', label: 'Contact Name', placeholder: 'John Doe' }] },
  { id: 'template:custom', name: 'Custom Task', icon: 'build', mcu: 50, description: 'Run any OpenClaw command', params: [{ key: 'command', label: 'Command', placeholder: '/cook build landing page for...' }] },
];

interface Props {
  balance?: number;
  onClose: () => void;
  onSuccess?: (missionId: string) => void;
}

export function MissionLauncher({ balance = 0, onClose, onSuccess }: Props) {
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
        body: JSON.stringify({ templateId: selected.id, params }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const data = await res.json();
      onSuccess?.(data.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Launch Mission</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {!selected ? (
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => { setSelected(t); setParams({}); }}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border border-gray-200 hover:border-orange-400 hover:bg-orange-50 text-left transition-colors cursor-pointer">
                <span className="material-symbols-outlined text-orange-500 text-2xl">{t.icon}</span>
                <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                <span className="text-xs text-gray-500">{t.description}</span>
                <span className="text-xs font-medium text-orange-600">{t.mcu} MCU</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <button type="button" onClick={() => setSelected(null)} aria-label="Back" className="text-sm text-orange-600 hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span> Back to templates
            </button>

            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
              <span className="material-symbols-outlined text-orange-500 text-2xl">{selected.icon}</span>
              <div>
                <p className="font-semibold text-gray-900">{selected.name}</p>
                <p className="text-xs text-gray-500">{selected.description}</p>
              </div>
              <span className="ml-auto text-sm font-bold text-orange-600">{selected.mcu} MCU</span>
            </div>

            {selected.params.map(p => (
              <div key={p.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{p.label}</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder={p.placeholder}
                  value={params[p.key] || ''}
                  onChange={e => setParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                  required
                />
              </div>
            ))}

            <div className="flex items-center justify-between text-sm text-gray-500 pt-1">
              <span>Balance: <strong className={insufficient ? 'text-red-600' : 'text-gray-900'}>{balance} MCU</strong></span>
              <span>Cost: <strong>{selected.mcu} MCU</strong></span>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {insufficient ? (
              <a href="/billing/upgrade" className="block w-full py-2.5 bg-orange-500 text-white rounded-xl text-center font-semibold hover:bg-orange-600 transition-colors">
                Insufficient credits — Upgrade Plan
              </a>
            ) : (
              <button type="submit" disabled={submitting}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {submitting ? 'Launching...' : 'Launch Mission'}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
