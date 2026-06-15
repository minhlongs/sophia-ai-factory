'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { generateImageAction } from '@/app/actions/image-generate-action';
import { ImagePromptForm } from './image-prompt-form';
import { ImageGallery, type ImageRecord } from './image-gallery';
import { useImageGeneration } from '../hooks/use-image-generation';
import type { Tier } from '@/seed/types';

interface ImageGeneratorTabProps {
  tier: Tier;
}

export function ImageGeneratorTab({ tier }: ImageGeneratorTabProps) {
  const t = useTranslations('creativeStudio.image');
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('flux-schnell');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [sessionImages, setSessionImages] = useState<ImageRecord[]>([]);

  // Poll the active job
  const polling = useImageGeneration(pollingJobId);

  // Sync polling results back into session image list
  useEffect(() => {
    if (!pollingJobId) return;
    if (polling.status === 'idle') return;

    setSessionImages((prev) =>
      prev.map((img) =>
        img.id === pollingJobId
          ? {
              ...img,
              status: polling.status,
              resultUrl: polling.resultUrl ?? undefined,
              thumbnailUrl: polling.thumbnailUrl ?? undefined,
            }
          : img,
      ),
    );

    if (polling.status === 'completed' || polling.status === 'failed') {
      setPollingJobId(null);
    }
  }, [pollingJobId, polling.status, polling.resultUrl, polling.thumbnailUrl]);

  const isGenerating = isSubmitting || polling.isPolling;

  const handleSubmit = useCallback(async () => {
    if (isGenerating || prompt.trim().length < 3) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await generateImageAction({ prompt: prompt.trim(), model, aspectRatio });

      if (!result.success) {
        setSubmitError(result.error);
        return;
      }

      const newRecord: ImageRecord = {
        id: result.jobId,
        status: 'pending',
        prompt: prompt.trim(),
        model,
        createdAt: Math.floor(Date.now() / 1000),
      };

      setSessionImages((prev) => [newRecord, ...prev]);
      setPollingJobId(result.jobId);
      setPrompt('');
    } finally {
      setIsSubmitting(false);
    }
  }, [isGenerating, prompt, model, aspectRatio]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left panel — form */}
      <div className="w-full lg:w-80 lg:shrink-0">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold text-foreground mb-4">{t('generateImage')}</h2>
          <ImagePromptForm
            prompt={prompt}
            onPromptChange={setPrompt}
            model={model}
            onModelChange={setModel}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            onSubmit={handleSubmit}
            isLoading={isGenerating}
            tier={tier}
          />

          {submitError && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>{submitError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — gallery */}
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-semibold text-foreground mb-4">{t('generatedImages')}</h2>
        <ImageGallery pendingImages={sessionImages} />
      </div>
    </div>
  );
}
