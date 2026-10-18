'use client';

import React from 'react';
import { Trash2, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/seed/components/ui/input';

export interface ProviderConfig {
  id: string;
  name: string;
  hint: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: 'openrouter', name: 'OpenRouter (LLM Scripting)', hint: 'sk-or-v1-...' },
  { id: 'elevenlabs', name: 'ElevenLabs (Voice Synthesis)', hint: 'xi-api-key...' },
  { id: 'fal-ai', name: 'fal.ai (Image & Diffusion)', hint: 'key-...' },
  { id: 'd-id', name: 'D-ID (Avatar Animation)', hint: 'Basic token or email:pass' },
];

export interface ProviderKeyCardProps {
  provider: ProviderConfig;
  isConfigured: boolean;
  isEditing: boolean;
  inputKey: string;
  actionLoading: boolean;
  onStartEdit: (providerId: string) => void;
  onCancelEdit: () => void;
  onInputKeyChange: (val: string) => void;
  onTestAndSave: (providerId: string) => void;
  onRevoke: (providerId: string) => void;
}

export function ProviderKeyCard({
  provider,
  isConfigured,
  isEditing,
  inputKey,
  actionLoading,
  onStartEdit,
  onCancelEdit,
  onInputKeyChange,
  onTestAndSave,
  onRevoke,
}: ProviderKeyCardProps) {
  return (
    <div className="p-4 bg-background/60 dark:bg-[#090A10]/60 rounded-xl border border-border dark:border-white/[0.08]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <div>
            <h4 className="text-sm font-bold text-foreground dark:text-white">{provider.name}</h4>
            <p className="text-xs text-muted-foreground font-mono">
              {isConfigured ? '••••••••••••••••••••••••••••' : provider.hint}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConfigured && !isEditing && (
            <button
              onClick={() => onRevoke(provider.id)}
              disabled={actionLoading}
              className="p-2 text-muted-foreground hover:text-destructive"
              title="Revoke"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {!isEditing ? (
            <button
              onClick={() => onStartEdit(provider.id)}
              className="text-xs font-semibold text-primary hover:underline px-3 py-1.5 border border-primary/30 rounded-lg hover:bg-primary/10"
            >
              {isConfigured ? 'Replace Key' : 'Connect'}
            </button>
          ) : (
            <button
              onClick={onCancelEdit}
              className="text-xs text-muted-foreground hover:text-foreground dark:hover:text-white px-2"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="mt-3 pt-3 border-t border-border dark:border-white/[0.08] flex flex-col sm:flex-row gap-2">
          <Input
            type="password"
            placeholder={`Enter ${provider.name} key`}
            value={inputKey}
            onChange={(e) => onInputKeyChange(e.target.value)}
            className="flex-1 bg-background dark:bg-[#090A10] text-xs font-mono"
          />
          <button
            onClick={() => onTestAndSave(provider.id)}
            disabled={actionLoading || !inputKey.trim()}
            className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm"
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Test & Save
          </button>
        </div>
      )}
    </div>
  );
}
