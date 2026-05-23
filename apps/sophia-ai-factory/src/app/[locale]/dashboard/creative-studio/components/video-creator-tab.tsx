'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Film, Loader2 } from 'lucide-react';
import { useToast } from '@/forest/hooks/use-toast';
import { generateVideoAction } from '@/app/actions/video-generate-action';
import type { Tier } from '@/seed/types';
import { VideoScriptInput } from './video-script-input';
import { VideoAvatarPicker } from './video-avatar-picker';
import { VideoVoicePicker } from './video-voice-picker';
import { VideoTemplateSelector } from './video-template-selector';

interface VideoCreatorTabProps {
  tier: Tier;
}

interface FormState {
  script: string;
  avatarId: string;
  voiceId: string;
  template: string;
}

const INITIAL_FORM: FormState = {
  script: '',
  avatarId: 'anna_costume1_cameraA',
  voiceId: 'adam',
  template: 'path-a',
};

/** Maps creative studio template choice to the generateVideoAction style enum */
function templateToStyle(template: string): 'cinematic' | 'casual' | 'educational' {
  return template === 'path-a' ? 'cinematic' : 'casual';
}

export function VideoCreatorTab({ tier }: VideoCreatorTabProps) {
  const t = useTranslations('creativeStudio');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [missionId, setMissionId] = useState<string | null>(null);
  const previewSteps = [
    { key: 'script', label: t('video.previewSteps.script') },
    { key: 'avatar', label: t('video.previewSteps.avatar') },
    { key: 'voice', label: t('video.previewSteps.voice') },
  ];

  function updateField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const result = await generateVideoAction({
        prompt: form.script,
        style: templateToStyle(form.template),
        language: 'en',
      });

      if (result.success) {
        setMissionId(result.missionId);
        toast({
          title: t('video.successTitle'),
          description: t('video.successDescription'),
        });
      } else {
        toast({
          title: t('video.errorTitle'),
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  }

  const canSubmit = form.script.length >= 10 && !isPending;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 shadow-sm">
        <VideoScriptInput
          value={form.script}
          onChange={(v) => updateField('script', v)}
        />
        <VideoAvatarPicker
          value={form.avatarId}
          onChange={(id) => updateField('avatarId', id)}
        />
        <VideoVoicePicker
          value={form.voiceId}
          onChange={(id) => updateField('voiceId', id)}
          tier={tier}
        />
        <VideoTemplateSelector
          value={form.template}
          onChange={(id) => updateField('template', id)}
        />

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isPending ? t('video.generating') : t('video.generate')}
        </button>
      </form>

      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="aspect-video bg-[radial-gradient(circle_at_25%_25%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--muted)),hsl(var(--background)))] p-4">
            <div className="flex h-full flex-col justify-between rounded-lg border border-white/20 bg-background/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {t('video.previewLabel')}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {t('video.previewPlaceholder')}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Film className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {previewSteps.map((step) => (
                  <div key={step.key} className="rounded-md border border-border bg-card/80 p-2">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {step.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {missionId && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">{t('video.missionCreated')}</p>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{missionId}</p>
            <Link
              href="/dashboard/videos"
              className="mt-1 inline-flex w-fit cursor-pointer text-xs font-medium text-primary underline underline-offset-2"
            >
              {t('video.trackProgress')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
