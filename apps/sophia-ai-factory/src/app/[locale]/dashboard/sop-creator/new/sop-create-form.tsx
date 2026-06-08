'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { createSopAction } from '../actions';

const SOP_CATEGORIES = [
  { value: 'content', label: 'Content' },
  { value: 'leads', label: 'Leads' },
  { value: 'email', label: 'Email' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'proposals', label: 'Proposals' },
  { value: 'crisis', label: 'Crisis' },
  { value: 'sales', label: 'Sales' },
  { value: 'social', label: 'Social' },
] as const;

const inputCls = 'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-violet-400';
const labelCls = 'block text-xs font-medium text-white/60 mb-1';

export function SopCreateForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createSopAction(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="name_en">Name (English) *</label>
          <input id="name_en" name="name_en" type="text" required className={inputCls} placeholder="My Awesome SOP" />
        </div>
        <div>
          <label className={labelCls} htmlFor="name_vi">Name (Vietnamese) *</label>
          <input id="name_vi" name="name_vi" type="text" required className={inputCls} placeholder="SOP của tôi" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="description_en">Description (English)</label>
          <textarea id="description_en" name="description_en" rows={3} className={inputCls} placeholder="What this SOP does..." />
        </div>
        <div>
          <label className={labelCls} htmlFor="description_vi">Description (Vietnamese)</label>
          <textarea id="description_vi" name="description_vi" rows={3} className={inputCls} placeholder="SOP này làm gì..." />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="category">Category *</label>
        <select id="category" name="category" required className={inputCls}>
          <option value="">Select category</option>
          {SOP_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls} htmlFor="playbook_md">Playbook (Markdown) *</label>
        <textarea id="playbook_md" name="playbook_md" required rows={8} className={inputCls} placeholder="# SOP Steps&#10;1. Step one..." />
      </div>

      <div>
        <label className={labelCls} htmlFor="agents_yaml">Agents Config (YAML) *</label>
        <textarea id="agents_yaml" name="agents_yaml" required rows={6} className={`${inputCls} font-mono text-xs`} placeholder="agents:&#10;  - name: agent1&#10;    model: gpt-4o" />
      </div>

      <div>
        <label className={labelCls} htmlFor="config_schema">Config Schema (JSON, optional)</label>
        <textarea id="config_schema" name="config_schema" rows={4} className={`${inputCls} font-mono text-xs`} placeholder='{"type":"object","properties":{...}}' />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls} htmlFor="price_usd">Price (USD) *</label>
          <input id="price_usd" name="price_usd" type="number" required min={5} max={999} step={1} defaultValue={29} className={inputCls} />
          <p className="mt-1 text-xs text-white/30">Min $5, max $999</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="setup_time_minutes">Setup Time (min)</label>
          <input id="setup_time_minutes" name="setup_time_minutes" type="number" min={1} max={480} defaultValue={30} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="credits_per_run">Credits / Run</label>
          <input id="credits_per_run" name="credits_per_run" type="number" min={1} max={1000} defaultValue={10} className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
        >
          {isPending ? 'Creating...' : 'Create SOP'}
        </button>
        <Link href="/dashboard/sop-creator" className="px-4 py-2.5 text-sm text-white/50 hover:text-white transition-colors">
          Cancel
        </Link>
      </div>
    </form>
  );
}
