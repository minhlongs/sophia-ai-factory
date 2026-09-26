'use client';

/**
 * Template Submit Modal Component
 *
 * Layer: land (pure UI component)
 *
 * Allows creators to submit video blueprints and displays real-time AI Quality Scorer
 * feedback across Hook, Storyboard, Script Cadence, and Niche Fit dimensions.
 *
 * @module land/marketplace/template-submit-modal
 */

import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  UploadCloud,
} from 'lucide-react';
import type { TargetPlatform, AspectRatio } from '@/tree/marketplace/types';
import { submitTemplate } from '@/land/marketplace/marketplace-actions';

export interface TemplateSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateCreated?: () => void;
}

export function TemplateSubmitModal({
  isOpen,
  onClose,
  onTemplateCreated,
}: TemplateSubmitModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [niche, setNiche] = useState('saas');
  const [platform, setPlatform] = useState<TargetPlatform>('tiktok');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [hookStyle, setHookStyle] = useState('curiosity_gap');
  const [scriptTemplate, setScriptTemplate] = useState('');
  const [visualStylePrompt, setVisualStylePrompt] = useState('Hyper-realistic cinematic 4k lighting with vibrant contrast');
  const [priceUsd, setPriceUsd] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    status: string;
    score?: number;
    feedback: string[];
    error?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionFeedback(null);

    const priceCents = Math.round(parseFloat(priceUsd || '0') * 100);

    try {
      const res = await submitTemplate({
        title,
        description,
        niche,
        targetPlatform: platform,
        aspectRatio,
        hookStyle,
        scriptTemplate,
        visualStylePrompt,
        priceCents,
      });

      if (res.success && res.data) {
        setSubmissionFeedback({
          status: res.data.status,
          score: res.data.template.quality_score,
          feedback: res.data.feedback,
        });
        if (onTemplateCreated) onTemplateCreated();
      } else {
        setSubmissionFeedback({
          status: 'error',
          feedback: [],
          error: res.error || 'Submission failed',
        });
      }
    } catch (err) {
      setSubmissionFeedback({
        status: 'error',
        feedback: [],
        error: String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md overflow-y-auto">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#161722] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Submit Video Blueprint</h3>
              <p className="text-xs text-muted-foreground">
                Earn 70% royalties each time community members activate your blueprint.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {submissionFeedback && (
          <div
            className={`mt-4 rounded-xl border p-4 text-xs ${
              submissionFeedback.status === 'approved'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : submissionFeedback.status === 'pending'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm mb-1">
              {submissionFeedback.status === 'approved' ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Auto-Approved to Marketplace (Score: {submissionFeedback.score}/100)
                </>
              ) : submissionFeedback.status === 'pending' ? (
                <>
                  <HelpCircle className="h-4 w-4" />
                  Pending Review Queue (Score: {submissionFeedback.score}/100)
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  {submissionFeedback.error || `Rejected (Score: ${submissionFeedback.score}/100)`}
                </>
              )}
            </div>

            {submissionFeedback.feedback.length > 0 && (
              <div className="mt-2 space-y-1">
                <span className="font-semibold">AI Quality Scorer Recommendations:</span>
                <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                  {submissionFeedback.feedback.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Blueprint Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-2.5 pl-7 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Niche</label>
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#1e202e] p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
              >
                <option value="saas">SaaS</option>
                <option value="finance">Finance</option>
                <option value="ecommerce">E-commerce</option>
                <option value="growth_hacking">Growth Hacking</option>
                <option value="tech">Tech & AI</option>
                <option value="fitness">Fitness</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Target Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as TargetPlatform)}
                className="w-full rounded-lg border border-white/10 bg-[#1e202e] p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
              >
                <option value="tiktok">TikTok</option>
                <option value="youtube_shorts">YouTube Shorts</option>
                <option value="instagram_reels">Instagram Reels</option>
                <option value="facebook_reels">Facebook Reels</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Hook Style</label>
              <select
                value={hookStyle}
                onChange={(e) => setHookStyle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#1e202e] p-2 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
              >
                <option value="curiosity_gap">Curiosity Gap</option>
                <option value="pattern_interrupt">Pattern Interrupt</option>
                <option value="bold_claim">Bold Claim</option>
                <option value="relatable_pain">Relatable Pain</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Script Template (with &#123;&#123;variables&#125;&#125;)
            </label>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Tip: Include viral words (secret, stop, mistake), open loop transitions (but, however), and a clear CTA.
            </p>
            <textarea
              rows={4}
              value={scriptTemplate}
              onChange={(e) => setScriptTemplate(e.target.value)}
              placeholder="Stop making this mistake with your {{product_name}}! The secret revealed today will save {{audience_group}} thousands of dollars..."
              className="w-full rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Visual Prompt Guidelines</label>
            <textarea
              rows={2}
              value={visualStylePrompt}
              onChange={(e) => setVisualStylePrompt(e.target.value)}
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
      </div>
    </div>
  );
}
