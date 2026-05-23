'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left panel — form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? t('video.generating') : t('video.generate')}
        </button>
      </form>

      {/* Right panel — preview / status */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border h-48 bg-muted/30">
          <p className="text-sm text-muted-foreground">{t('video.previewPlaceholder')}</p>
        </div>

        {missionId && (
          <div className="rounded-lg border border-border p-4 flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{t('video.missionCreated')}</p>
            <p className="text-xs text-muted-foreground font-mono">{missionId}</p>
            <Link
              href="/dashboard/videos"
              className="mt-1 inline-block text-xs text-primary underline underline-offset-2"
            >
              {t('video.trackProgress')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
