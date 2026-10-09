/**
 * White-Label Manager Add Custom Domain Form Card.
 *
 * Layer: forest (UI component composition)
 *
 * @module forest/admin/white-label/domain-add-card
 */

import React from 'react';
import { Globe, Plus, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DomainAddCardProps {
  newHostname: string;
  setNewHostname: (value: string) => void;
  isAddingDomain: boolean;
  domainError: string | null;
  domainSuccess: string | null;
  onAddDomain: (e: React.FormEvent) => Promise<void>;
  labels: {
    addButton: string;
    description: string;
    inputPlaceholder: string;
    adding: string;
  };
}

export function DomainAddCard({
  newHostname,
  setNewHostname,
  isAddingDomain,
  domainError,
  domainSuccess,
  onAddDomain,
  labels,
}: DomainAddCardProps) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Plus className="w-5 h-5 text-indigo-400" />
        {labels.addButton}
      </h2>
      <p className="text-sm text-zinc-400 mt-1">{labels.description}</p>

      <form onSubmit={onAddDomain} className="mt-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Globe className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={newHostname}
            onChange={(e) => setNewHostname(e.target.value)}
            placeholder={labels.inputPlaceholder}
            disabled={isAddingDomain}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <button
          type="submit"
          disabled={isAddingDomain || !newHostname.trim()}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all"
        >
          {isAddingDomain ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {labels.adding}
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              {labels.addButton}
            </>
          )}
        </button>
      </form>

      {domainError && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{domainError}</span>
        </div>
      )}

      {domainSuccess && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{domainSuccess}</span>
        </div>
      )}
    </div>
  );
}
