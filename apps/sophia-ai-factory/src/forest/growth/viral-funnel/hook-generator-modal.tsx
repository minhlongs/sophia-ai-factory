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

        {/* Generator Form */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              {isVi ? 'Lĩnh Vực Mục Tiêu' : 'Target Niche'}
            </label>
            <select
              value={genNiche}
              onChange={(e) => setGenNiche(e.target.value as ViralNiche)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ai_automation">{isVi ? 'Tự Động Hóa AI' : 'AI Automation'}</option>
              <option value="ecommerce">{isVi ? 'Thương Mại Điện Tử' : 'E-commerce'}</option>
              <option value="solopreneur">{isVi ? 'Kinh Doanh Độc Lập' : 'Solopreneur'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              {isVi ? 'Loại Hook (Tâm Lý)' : 'Hook Archetype'}
            </label>
            <select
              value={genArchetype}
              onChange={(e) => setGenArchetype(e.target.value as HookArchetype)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="curiosity_gap">{isVi ? 'Khoảng Trống Tò Mò' : 'Curiosity Gap'}</option>
              <option value="shock_stat">{isVi ? 'Số Liệu Gây Sốc' : 'Shocking Stat'}</option>
              <option value="direct_question">{isVi ? 'Câu Hỏi Trực Diện' : 'Direct Question'}</option>
              <option value="problem_solution">{isVi ? 'Đảo Ngược Vấn Đề' : 'Problem-Solution'}</option>
              <option value="contrarian">{isVi ? 'Quan Điểm Ngược Dòng' : 'Contrarian'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              {isVi ? 'Chủ Đề Hoặc Ưu Đãi' : 'Custom Topic / Offer'}
            </label>
            <input
              type="text"
              placeholder={isVi ? 'Ví dụ: Khóa học AI 1 người...' : 'e.g. 1-person AI stack...'}
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGenerateHooks}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            {isGenerating
              ? isVi ? 'Đang Tạo...' : 'Generating...'
              : isVi ? 'Tạo Biến Thể Hook' : 'Generate Hook Variants'}
          </button>
        </div>

        {/* Generated Hooks Carousel / List */}
        {generatedHooks.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              {isVi ? 'Biến Thể Mở Đầu Đề Xuất (Bấm Để Chọn):' : 'Recommended Opening Hooks (Tap to Select):'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {generatedHooks.map((h) => (
                <button
                  key={h.id}
                  onClick={() => handleSelectHook(h)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    selectedHook?.id === h.id
                      ? 'border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500'
                      : 'border-neutral-800 bg-neutral-800/40 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      {h.archetype.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400">
                      {h.expectedRetentionScore}% {isVi ? 'Giữ Chân' : 'Retention'}
                    </span>
                  </div>
                  <p className="text-xs text-white font-medium">
                    {isVi ? h.hookTextVi : h.hookText}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Script Breakdown */}
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
