'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import type { SubmitFormData } from './types';
import { SubmitCategorySelects } from './submit-category-selects';

interface SubmitFormFieldsProps {
  formData: SubmitFormData;
  setFormData: React.Dispatch<React.SetStateAction<SubmitFormData>>;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function SubmitFormFields({
  formData,
  setFormData,
  isSubmitting,
  onSubmit,
  onClose,
}: SubmitFormFieldsProps) {
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">Blueprint Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. 3 SaaS Growth Hacks That Made Us $100k"
            className="w-full rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">Price (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">$</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={formData.priceUsd}
              onChange={(e) => setFormData((prev) => ({ ...prev, priceUsd: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-black/30 p-2.5 pl-7 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>
        </div>
      </div>

      <SubmitCategorySelects formData={formData} setFormData={setFormData} />

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1">
          Script Template (with &#123;&#123;variables&#125;&#125;)
        </label>
        <p className="text-[11px] text-muted-foreground mb-1.5">
          Tip: Include viral words (secret, stop, mistake), open loop transitions (but, however), and a clear CTA.
        </p>
        <textarea
          rows={4}
          value={formData.scriptTemplate}
          onChange={(e) => setFormData((prev) => ({ ...prev, scriptTemplate: e.target.value }))}
          placeholder="Stop making this mistake with your {{product_name}}! The secret revealed today will save {{audience_group}} thousands of dollars..."
          className="w-full rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-foreground mb-1">Visual Prompt Guidelines</label>
        <textarea
          rows={2}
          value={formData.visualStylePrompt}
          onChange={(e) => setFormData((prev) => ({ ...prev, visualStylePrompt: e.target.value }))}
          className="w-full rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
          required
        />
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 px-4 py-2 text-xs text-muted-foreground hover:bg-white/5 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {isSubmitting ? 'Evaluating Quality...' : 'Analyze & Submit Blueprint'}
        </button>
      </div>
    </form>
  );
}
