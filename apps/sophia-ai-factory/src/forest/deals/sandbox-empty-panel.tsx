/**
 * Empty-state panel prompting sandbox provisioning
 *
 * Layer: forest/deals (UI presentation)
 *
 * @module forest/deals/sandbox-empty-panel
 */

import React from 'react';
import { Layers, Sparkles } from 'lucide-react';

interface SandboxEmptyPanelProps {
  onProvision: () => Promise<void>;
  isLoading: boolean;
}

export function SandboxEmptyPanel({ onProvision, isLoading }: SandboxEmptyPanelProps) {
  return (
    <div className="text-center py-8 space-y-4">
      <Layers className="w-12 h-12 mx-auto text-zinc-600" />
      <div>
        <h3 className="text-base font-medium text-white">No Demo Workspace Provisioned</h3>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
          Click below to instantly create an isolated client subaccount with 1,000 demo MCUs and generate a 14-day signed access link.
        </p>
      </div>

      <button
        onClick={onProvision}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" />
        {isLoading ? 'Provisioning Sandbox...' : 'Activate 1-Click Demo Sandbox'}
      </button>
    </div>
  );
}
