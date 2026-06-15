'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { CheckCircle2, Film, Loader2, ArrowLeft, ArrowRight, Sparkles, HelpCircle } from 'lucide-react';
import { useToast } from '@/forest/hooks/use-toast';
import { generateVideoAction } from '@/app/actions/video-generate-action';
import type { Tier } from '@/seed/types';
import { VideoScriptInput } from './video-script-input';
import { VideoAvatarPicker } from './video-avatar-picker';
import { VideoVoicePicker } from './video-voice-picker';
import { VideoTemplateSelector } from './video-template-selector';
import { WizardStepper } from '@/tree/components/setup-wizard/wizard-stepper';

interface VideoCreatorTabProps {
  tier: Tier;
}

interface FormState {
  prompt: string;
  script: string;
  avatarId: string;
  voiceId: string;
  template: string;
}

const INITIAL_FORM: FormState = {
  prompt: '',
  script: '',
  avatarId: 'anna_costume1_cameraA',
  voiceId: 'adam',
  template: 'path-a',
};

function templateToStyle(template: string): 'cinematic' | 'casual' | 'educational' {
  return template === 'path-a' ? 'cinematic' : 'casual';
}

export function VideoCreatorTab({ tier }: VideoCreatorTabProps) {
  const t = useTranslations('creativeStudio.videoCreator');
  const locale = useLocale();
  const isVi = locale.startsWith('vi');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const stepLabels = [
    t('step_topic'),
    t('step_script'),
    t('step_voice'),
    t('step_visuals'),
    t('step_confirm'),
  ];

  function updateField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  const generateDraftScript = () => {
    if (!form.prompt) return;
    const topic = form.prompt;
    const draft = isVi
      ? `[Chào bạn! Dưới đây là video chia sẻ về: ${topic}]\n\nBạn có biết rằng hầu hết chúng ta đều mắc sai lầm này không? Đầu tiên, hãy tập trung vào giá trị dài hạn. Thứ hai, quản lý ngân sách thông minh. Và cuối cùng, hãy hành động ngay hôm nay! Hãy đăng ký kênh để xem thêm nhiều nội dung bổ ích khác nhé.`
      : `[Hey there! Today we are talking about: ${topic}]\n\nDid you know that most people get this wrong? First, focus on long-term value. Second, manage your budget intelligently. And finally, take action today! Subscribe for more valuable insights.`;
    updateField('script', draft);
  };

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-border/50 bg-muted-900/40 backdrop-blur-sm p-5 md:p-6 shadow-xl relative overflow-hidden">
        {/* Wizard Stepper */}
        <WizardStepper currentStep={step} steps={stepLabels} />

        {/* Step Content */}
        <div className="min-h-[220px] flex flex-col justify-center">
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="video-prompt" className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground-200">
                    <Sparkles className="h-4 w-4 text-primary-400" />
                    {t('step1_label')}
                  </label>
                  <div className="group relative">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-muted-foreground-300 cursor-help" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex w-48 rounded bg-muted-950 border border-border/50 p-2 text-xs text-muted-foreground-300 shadow-xl z-20">
                      {t('step1_hint')}
                    </span>
                  </div>
                </div>
                <textarea
                  id="video-prompt"
                  value={form.prompt}
                  onChange={(e) => updateField('prompt', e.target.value)}
                  rows={5}
                  maxLength={500}
                  placeholder={t('step1_placeholder')}
                  className="rounded-lg border border-border/50 bg-black/40 px-3 py-2 text-sm text-foreground placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('step1_helper')}</span>
                  <span>{form.prompt.length}/500</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('step2_label')}</span>
                {form.prompt && (
                  <button
                    type="button"
                    onClick={generateDraftScript}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    {t('step2_regenerate')}
                  </button>
                )}
              </div>
              <VideoScriptInput
                value={form.script}
                onChange={(v) => updateField('script', v)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground-200">{t('step3_label')}</span>
                <div className="group relative">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-muted-foreground-300 cursor-help" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex w-48 rounded bg-muted-950 border border-border/50 p-2 text-[10px] text-muted-foreground-300 shadow-xl z-20">
                    {t('step3_hint')}
                  </span>
                </div>
              </div>
              <VideoVoicePicker
                value={form.voiceId}
                onChange={(id) => updateField('voiceId', id)}
                tier={tier}
              />
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground-200">{t('step4_label1')}</span>
                  <div className="group relative">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-muted-foreground-300 cursor-help" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex w-48 rounded bg-muted-950 border border-border/50 p-2 text-xs text-muted-foreground-300 shadow-xl z-20">
                      {t('step4_hint1')}
                    </span>
                  </div>
                </div>
                <VideoAvatarPicker
                  value={form.avatarId}
                  onChange={(id) => updateField('avatarId', id)}
                />
              </div>
              <div className="flex flex-col gap-2 border-t border-border/10 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground-200">{t('step4_label2')}</span>
                  <div className="group relative">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-muted-foreground-300 cursor-help" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex w-48 rounded bg-muted-950 border border-border/50 p-2 text-xs text-muted-foreground-300 shadow-xl z-20">
                      {t('step4_hint2')}
                    </span>
                  </div>
                </div>
                <VideoTemplateSelector
                  value={form.template}
                  onChange={(id) => updateField('template', id)}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="rounded-xl border border-border/50 bg-black/30 p-4 space-y-3">
                <h4 className="font-bold text-xs text-primary-400 uppercase tracking-wider">{t('step5_review')}</h4>
                <div className="space-y-2 text-xs md:text-sm">
                  <div className="flex justify-between border-b border-border/10 pb-1">
                    <span className="text-muted-foreground">{t('step5_avatar')}:</span>
                    <span className="font-medium text-foreground">{form.avatarId}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/10 pb-1">
                    <span className="text-muted-foreground">{t('step5_voice')}:</span>
                    <span className="font-medium text-foreground">{form.voiceId}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/10 pb-1">
                    <span className="text-muted-foreground">{t('step5_template')}:</span>
                    <span className="font-medium text-foreground capitalize">{form.template}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-muted-foreground">{t('step5_script')}:</span>
                    <p className="bg-black/40 border border-border/10 p-3 rounded-lg text-xs font-mono text-muted-foreground-300 max-h-[80px] overflow-y-auto">
                      {form.script || t('step5_empty')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Controls */}
        <div className="mt-6 flex justify-between gap-3 border-t border-border/10 pt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border hover:border-border bg-muted/20 px-4 py-2 text-xs md:text-sm font-semibold text-foreground hover:bg-white/10 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('btn_back')}
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1 && !form.script && form.prompt) {
                  generateDraftScript();
                }
                setStep((s) => s + 1);
              }}
              disabled={step === 1 && !form.prompt.trim()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 px-5 py-2 text-xs md:text-sm font-semibold text-foreground transition disabled:opacity-50"
            >
              {t('btn_next')}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit || isPending}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 px-6 py-2 text-xs md:text-sm font-bold text-foreground transition disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? t('video.generating') : t('video.generate')}
            </button>
          )}
        </div>
      </form>

      {/* Live Preview Sidebar */}
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-border/50 bg-muted-950 shadow-xl">
          <div className="aspect-video bg-[radial-gradient(circle_at_25%_25%,hsl(var(--primary)/0.15),transparent_40%),linear-gradient(135deg,rgba(15,15,20,0.9),rgba(20,10,35,0.9))] p-4 relative">
            <div className="flex h-full flex-col justify-between rounded-lg border border-border/50 bg-muted-900/60 backdrop-blur-md p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-400">
                    {t('video.previewLabel')}
                  </p>
                  <p className="mt-1 text-xs md:text-sm font-semibold text-muted-foreground-100 line-clamp-1">
                    {form.prompt ? `"${form.prompt}"` : t('video.previewPlaceholder')}
                  </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-foreground shadow-lg shadow-violet-500/30">
                  <Film className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>

              {/* Dynamic Mock Avatar Frame */}
              <div className="my-2 flex flex-col items-center justify-center border border-dashed border-border/50 rounded p-2 bg-black/40 text-center">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">{t('presenting_avatar')}</span>
                <span className="text-xs font-semibold text-accent-400 mt-0.5">{form.avatarId}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`rounded border p-1.5 transition-colors duration-200 ${step === 2 ? 'border-primary-500 bg-primary-500/10' : 'border-border/10 bg-muted/10'}`}>
                  <p className="text-xs font-medium text-muted-foreground">{t('preview_script')}</p>
                  <p className="text-[10px] font-bold text-foreground truncate">
                    {form.script ? `${form.script.length} chars` : "-"}
                  </p>
                </div>
                <div className={`rounded border p-1.5 transition-colors duration-200 ${step === 3 ? 'border-primary-500 bg-primary-500/10' : 'border-border/10 bg-muted/10'}`}>
                  <p className="text-xs font-medium text-muted-foreground">{t('preview_voice')}</p>
                  <p className="text-[10px] font-bold text-foreground truncate">
                    {form.voiceId}
                  </p>
                </div>
                <div className={`rounded border p-1.5 transition-colors duration-200 ${step === 4 ? 'border-primary-500 bg-primary-500/10' : 'border-border/10 bg-muted/10'}`}>
                  <p className="text-xs font-medium text-muted-foreground">{t('preview_template')}</p>
                  <p className="text-[10px] font-bold text-foreground truncate capitalize">
                    {form.template}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {missionId && (
          <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-muted-900/40 p-4 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">{t('video.missionCreated')}</p>
            </div>
            <p className="text-xs text-muted-foreground font-mono bg-black/25 p-2 rounded border border-border/10">{missionId}</p>
            <Link
              href="/dashboard/videos"
              className="mt-1 inline-flex w-fit cursor-pointer text-xs font-medium text-primary-400 hover:text-primary-300 underline underline-offset-2"
            >
              {t('video.trackProgress')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
