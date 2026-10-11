import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { submitTemplate } from '@/land/marketplace/marketplace-actions';
import type { TemplateSubmitModalProps, SubmissionFeedback, SubmitFormData } from './types';
import { SubmissionFeedbackBanner } from './feedback-banner';
import { SubmitFormFields } from './submit-form-fields';

export function TemplateSubmitModalView({
  isOpen,
  onClose,
  onTemplateCreated,
}: TemplateSubmitModalProps) {
  const [formData, setFormData] = useState<SubmitFormData>({
    title: '',
    description: '',
    niche: 'saas',
    platform: 'tiktok',
    aspectRatio: '9:16',
    hookStyle: 'curiosity_gap',
    scriptTemplate: '',
    visualStylePrompt: 'Hyper-realistic cinematic 4k lighting with vibrant contrast',
    priceUsd: '10',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<SubmissionFeedback | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionFeedback(null);

    const priceCents = Math.round(parseFloat(formData.priceUsd || '0') * 100);

    try {
      const res = await submitTemplate({
        title: formData.title,
        description: formData.description,
        niche: formData.niche,
        targetPlatform: formData.platform,
        aspectRatio: formData.aspectRatio,
        hookStyle: formData.hookStyle,
        scriptTemplate: formData.scriptTemplate,
        visualStylePrompt: formData.visualStylePrompt,
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

        {submissionFeedback && <SubmissionFeedbackBanner feedback={submissionFeedback} />}

        <SubmitFormFields
          formData={formData}
          setFormData={setFormData}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
