/**
 * Viral Hook Generator input form (niche, archetype, topic, submit)
 *
 * Layer: Forest (UI components & coordinators)
 *
 * @module forest/growth/viral-funnel/hook-generator-form
 */

import React from 'react';
import type { ViralNiche, HookArchetype } from '@/seed/types/growth';

export interface HookGeneratorFormProps {
  isVi: boolean;
  genNiche: ViralNiche;
  setGenNiche: (niche: ViralNiche) => void;
  genArchetype: HookArchetype;
  setGenArchetype: (archetype: HookArchetype) => void;
  genTopic: string;
  setGenTopic: (topic: string) => void;
  isGenerating: boolean;
  handleGenerateHooks: () => Promise<void>;
}

const FIELD_CLASS =
  'w-full px-3 py-2 rounded-lg text-sm bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500';
const LABEL_CLASS = 'block text-xs font-medium text-neutral-400 mb-1.5';

export function HookGeneratorForm({
  isVi,
  genNiche,
  setGenNiche,
  genArchetype,
  setGenArchetype,
  genTopic,
  setGenTopic,
  isGenerating,
  handleGenerateHooks,
}: HookGeneratorFormProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={LABEL_CLASS}>{isVi ? 'Lĩnh Vực Mục Tiêu' : 'Target Niche'}</label>
          <select
            value={genNiche}
            onChange={(e) => setGenNiche(e.target.value as ViralNiche)}
            className={FIELD_CLASS}
          >
            <option value="ai_automation">{isVi ? 'Tự Động Hóa AI' : 'AI Automation'}</option>
            <option value="ecommerce">{isVi ? 'Thương Mại Điện Tử' : 'E-commerce'}</option>
            <option value="solopreneur">{isVi ? 'Kinh Doanh Độc Lập' : 'Solopreneur'}</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>{isVi ? 'Loại Hook (Tâm Lý)' : 'Hook Archetype'}</label>
          <select
            value={genArchetype}
            onChange={(e) => setGenArchetype(e.target.value as HookArchetype)}
            className={FIELD_CLASS}
          >
            <option value="curiosity_gap">{isVi ? 'Khoảng Trống Tò Mò' : 'Curiosity Gap'}</option>
            <option value="shock_stat">{isVi ? 'Số Liệu Gây Sốc' : 'Shocking Stat'}</option>
            <option value="direct_question">{isVi ? 'Câu Hỏi Trực Diện' : 'Direct Question'}</option>
            <option value="problem_solution">{isVi ? 'Đảo Ngược Vấn Đề' : 'Problem-Solution'}</option>
            <option value="contrarian">{isVi ? 'Quan Điểm Ngược Dòng' : 'Contrarian'}</option>
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS}>{isVi ? 'Chủ Đề Hoặc Ưu Đãi' : 'Custom Topic / Offer'}</label>
          <input
            type="text"
            placeholder={isVi ? 'Ví dụ: Khóa học AI 1 người...' : 'e.g. 1-person AI stack...'}
            value={genTopic}
            onChange={(e) => setGenTopic(e.target.value)}
            className={`${FIELD_CLASS} placeholder-neutral-500`}
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
    </>
  );
}
