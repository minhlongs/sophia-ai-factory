/**
 * Viral Hook & Script Generation Drawer Modal
 *
 * Layer: Forest (UI components & coordinators)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/viral-funnel/hook-generator-modal
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import type {
  ViralNiche,
  HookArchetype,
  ViralHook,
  ViralScript,
} from '@/seed/types/growth';
import { ScriptBreakdownCard } from './script-breakdown-card';
import { HookGeneratorForm } from './hook-generator-form';
import { GeneratedHooksList } from './generated-hooks-list';

interface HookGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isVi: boolean;
  genNiche: ViralNiche;
  setGenNiche: (niche: ViralNiche) => void;
  genArchetype: HookArchetype;
  setGenArchetype: (archetype: HookArchetype) => void;
  genTopic: string;
  setGenTopic: (topic: string) => void;
  generatedHooks: ViralHook[];
  selectedHook: ViralHook | null;
  activeScript: ViralScript | null;
  isGenerating: boolean;
  handleGenerateHooks: () => Promise<void>;
  handleSelectHook: (hook: ViralHook) => Promise<void>;
  copyToClipboard: (text: string, key: string) => Promise<void>;
  copiedKey: string | null;
}

export function HookGeneratorModal({
  isOpen,
  onClose,
  isVi,
  genNiche,
  setGenNiche,
  genArchetype,
  setGenArchetype,
  genTopic,
  setGenTopic,
  generatedHooks,
  selectedHook,
  activeScript,
  isGenerating,
  handleGenerateHooks,
  handleSelectHook,
  copyToClipboard,
  copiedKey,
}: HookGeneratorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">
              {isVi ? 'Trợ Lý Tạo Hook & Kịch Bản Viral' : 'Viral Hook & Script Studio'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>

        <HookGeneratorForm
          isVi={isVi}
          genNiche={genNiche}
          setGenNiche={setGenNiche}
          genArchetype={genArchetype}
          setGenArchetype={setGenArchetype}
          genTopic={genTopic}
          setGenTopic={setGenTopic}
          isGenerating={isGenerating}
          handleGenerateHooks={handleGenerateHooks}
        />

        <GeneratedHooksList
          isVi={isVi}
          hooks={generatedHooks}
          selectedHook={selectedHook}
          onSelect={handleSelectHook}
        />

        {activeScript && (
          <ScriptBreakdownCard
            script={activeScript}
            isVi={isVi}
            copiedKey={copiedKey}
            copyToClipboard={copyToClipboard}
          />
        )}
      </div>
    </div>
  );
}
