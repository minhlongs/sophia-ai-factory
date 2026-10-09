/**
 * White-Label Manager Header and Tab Navigation Bar.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/header-tabs
 */

import React from 'react';
import { Globe, Palette, Eye } from 'lucide-react';
import type { WhiteLabelTab, HeaderTabLabels } from './types';

export type { HeaderTabLabels };

interface HeaderTabsProps {
  activeTab: WhiteLabelTab;
  setActiveTab: (tab: WhiteLabelTab) => void;
  labels: HeaderTabLabels;
}

export function HeaderTabs({
  activeTab,
  setActiveTab,
  labels,
}: HeaderTabsProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
      <div>
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Globe className="w-6 h-6" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">{labels.title}</h1>
        </div>
        <p className="text-sm text-zinc-400 mt-2 max-w-2xl">{labels.subtitle}</p>
      </div>

      <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl self-start md:self-auto">
        <button
          type="button"
          onClick={() => setActiveTab('domains')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'domains'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          {labels.domains}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'branding'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Palette className="w-4 h-4" />
          {labels.branding}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'preview'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Eye className="w-4 h-4" />
          {labels.preview}
        </button>
      </div>
    </div>
  );
}
