'use client';

/**
 * New Enterprise Deal Modal Header & Action Footer
 *
 * Layer: forest/deals/new-deal
 */

import React from 'react';
import { X, Plus, Sparkles } from 'lucide-react';

interface DealModalHeaderProps {
  onClose: () => void;
}

export function DealModalHeader({ onClose }: DealModalHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Plus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Ingest New Enterprise Deal</h2>
          <p className="text-xs text-zinc-400">
            Adds lead to autonomous BANT qualification &amp; sales pipeline
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

interface DealModalFooterProps {
  onClose: () => void;
  isLoading: boolean;
}

export function DealModalFooter({ onClose, isLoading }: DealModalFooterProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isLoading}
        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" />
        {isLoading ? 'Creating & Qualifying...' : 'Create & Qualify Deal'}
      </button>
    </div>
  );
}
