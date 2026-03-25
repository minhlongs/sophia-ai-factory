'use client';

/**
 * New Mission Creation Page
 * Select a command template, fill dynamic params, preview MCU cost, submit.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CommandTemplate {
  id: string;
  name: string;
  icon: string;
  mcu: number;
  description: string;
  params: { key: string; label: string; placeholder: string }[];
}

const COMMANDS: CommandTemplate[] = [
  { id: 'proposal:text:advanced',    name: 'Proposal (Advanced)',    icon: 'description',      mcu: 25,  description: 'AI-written sales proposal',          params: [{ key: 'company', label: 'Company Name', placeholder: 'Acme Corp' }, { key: 'goal', label: 'Goal', placeholder: 'Increase revenue by 30%' }] },
  { id: 'affiliate:blog',            name: 'Blog Post',              icon: 'article',           mcu: 50,  description: 'SEO-optimized blog article',          params: [{ key: 'topic', label: 'Topic', placeholder: 'AI automation for agencies' }] },
  { id: 'affiliate:social',          name: 'Social Bundle',          icon: 'share',             mcu: 10,  description: 'LinkedIn + Twitter + TikTok posts',   params: [{ key: 'topic', label: 'Topic', placeholder: 'Product launch announcement' }] },
  { id: 'video:intro',               name: 'Intro Video',            icon: 'play_circle',       mcu: 100, description: '30s HeyGen intro video',              params: [{ key: 'script', label: 'Key Message', placeholder: 'What should the video convey?' }] },
  { id: 'affiliate:video',           name: 'Video Review',           icon: 'video_library',     mcu: 200, description: 'Full product video review',           params: [{ key: 'product', label: 'Product', placeholder: 'Product name or URL' }] },
  { id: 'sales:proposal-deck',       name: 'Sales Deck',             icon: 'slideshow',         mcu: 10,  description: 'Full proposal deck with slides',      params: [{ key: 'client_name', label: 'Client Name', placeholder: 'Acme Corp' }, { key: 'industry', label: 'Industry', placeholder: 'Digital Agency' }] },
  { id: 'sales:roi-calculator',      name: 'ROI Calculator',         icon: 'calculate',         mcu: 5,   description: 'ROI projection for prospects',        params: [{ key: 'proposals_per_month', label: 'Proposals/Month', placeholder: '20' }, { key: 'avg_deal_size', label: 'Avg Deal Size ($)', placeholder: '5000' }] },
  { id: 'sales:competitor-analysis', name: 'Competitor Intel',       icon: 'query_stats',       mcu: 8,   description: 'SWOT analysis + win strategy',        params: [{ key: 'competitors', label: 'Competitors (comma-sep)', placeholder: 'Proposify, PandaDoc' }] },
  { id: 'sales:outreach-sequence',   name: 'Outreach Sequence',      icon: 'forward_to_inbox',  mcu: 8,   description: 'Email + LinkedIn outreach',           params: [{ key: 'prospect_company', label: 'Company', placeholder: 'Target Corp' }, { key: 'prospect_name', label: 'Contact Name', placeholder: 'John Doe' }] },
  { id: 'content:newsletter',        name: 'Newsletter',             icon: 'mail',              mcu: 30,  description: 'Branded email newsletter',            params: [{ key: 'topic', label: 'Topic', placeholder: 'Monthly AI trends update' }] },
  { id: 'content:case-study',        name: 'Case Study',             icon: 'workspace_premium', mcu: 40,  description: 'Client success story',                params: [{ key: 'client', label: 'Client', placeholder: 'Acme Corp' }, { key: 'result', label: 'Key Result', placeholder: '3x revenue in 90 days' }] },
  { id: 'content:whitepaper',        name: 'Whitepaper',             icon: 'menu_book',         mcu: 80,  description: 'In-depth technical whitepaper',       params: [{ key: 'topic', label: 'Topic', placeholder: 'AI in B2B Sales' }] },
  { id: 'ads:google',                name: 'Google Ads Copy',        icon: 'ads_click',         mcu: 15,  description: 'Search ad headlines + descriptions',  params: [{ key: 'product', label: 'Product/Service', placeholder: 'AI proposal software' }] },
  { id: 'ads:meta',                  name: 'Meta Ads Copy',          icon: 'campaign',          mcu: 15,  description: 'Facebook/Instagram ad copy',          params: [{ key: 'product', label: 'Product/Service', placeholder: 'AI proposal software' }] },
  { id: 'seo:audit',                 name: 'SEO Audit',              icon: 'manage_search',     mcu: 20,  description: 'On-page SEO analysis + fixes',        params: [{ key: 'url', label: 'Website URL', placeholder: 'https://example.com' }] },
  { id: 'crm:lead-score',            name: 'Lead Scoring',           icon: 'leaderboard',       mcu: 12,  description: 'AI lead scoring + prioritization',    params: [{ key: 'lead_data', label: 'Lead Info', placeholder: 'Company size, industry, intent signals…' }] },
  { id: 'template:custom',           name: 'Custom Task',            icon: 'build',             mcu: 50,  description: 'Run any OpenClaw command',            params: [{ key: 'command', label: 'Command', placeholder: '/cook build landing page for...' }] },
];

export default function NewMissionPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<CommandTemplate | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/raas/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selected.id, params }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to create mission');
      const data = await res.json();
      router.push(`/missions/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/missions"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-orange-600 transition-colors"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Missions
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-700">New Mission</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">New Mission</h1>

      {!selected ? (
        /* Command selector grid */
        <div>
          <p className="text-sm text-gray-500 mb-4">Select a command to run:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {COMMANDS.map(cmd => (
              <button
                key={cmd.id}
                onClick={() => { setSelected(cmd); setParams({}); }}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border border-gray-200 hover:border-orange-400 hover:bg-orange-50 text-left transition-colors"
              >
                <span className="material-symbols-outlined text-orange-500 text-2xl">{cmd.icon}</span>
                <span className="text-sm font-semibold text-gray-900">{cmd.name}</span>
                <span className="text-xs text-gray-500 line-clamp-2">{cmd.description}</span>
                <span className="text-xs font-medium text-orange-600 mt-auto">{cmd.mcu} MCU</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Params form */
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selected command summary */}
          <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
            <span className="material-symbols-outlined text-orange-500 text-2xl">{selected.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{selected.name}</p>
              <p className="text-xs text-gray-500">{selected.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-orange-600">{selected.mcu} MCU</p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-gray-400 hover:text-orange-600"
              >
                Change
              </button>
            </div>
          </div>

          {/* Dynamic param inputs */}
          {selected.params.map(p => (
            <div key={p.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{p.label}</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                placeholder={p.placeholder}
                value={params[p.key] ?? ''}
                onChange={e => setParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                required
              />
            </div>
          ))}

          {/* MCU cost estimate */}
          <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <span className="text-gray-600">Estimated cost</span>
            <span className="font-bold text-gray-900">{selected.mcu} MCU</span>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Launching…' : 'Launch Mission'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
