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

/** Maps creative studio template choice to the generateVideoAction style enum */
function templateToStyle(template: string): 'cinematic' | 'casual' | 'educational' {
  return template === 'path-a' ? 'cinematic' : 'casual';
}

export function VideoCreatorTab({ tier }: VideoCreatorTabProps) {
  const t = useTranslations('creativeStudio');
  const locale = useLocale();
  const isVi = locale.startsWith('vi');
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const stepLabels = isVi 
    ? ["Ý tưởng", "Kịch bản", "Giọng nói", "Hình ảnh", "Xác nhận"]
    : ["Topic", "Script", "Voice", "Visuals", "Confirm"];

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
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm p-5 md:p-6 shadow-xl relative overflow-hidden">
        {/* Wizard Stepper */}
        <WizardStepper currentStep={step} steps={stepLabels} />

        {/* Step Content */}
        <div className="min-h-[220px] flex flex-col justify-center">
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="video-prompt" className="text-sm font-semibold flex items-center gap-1.5 text-zinc-200">
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    {isVi ? "Ý tưởng / Chủ đề Video" : "Video Topic / Ideas"}
                  </label>
                  <div className="group relative">
                    <HelpCircle className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex w-48 rounded bg-zinc-950 border border-white/10 p-2 text-[10px] text-zinc-300 shadow-xl z-20">
                      {isVi 
                        ? "Mô tả ý tưởng ngắn gọn, AI của chúng tôi sẽ viết chi tiết kịch bản video." 
                        : "Describe your video topic. Our AI will automatically compose the script."}
                    </span>
                  </div>
                </div>
                <textarea
                  id="video-prompt"
                  value={form.prompt}
                  onChange={(e) => updateField('prompt', e.target.value)}
                  rows={5}
                  maxLength={500}
                  placeholder={isVi ? "Ví dụ: 3 bài học đắt giá về đầu tư tài chính cá nhân dành cho giới trẻ..." : "e.g. 3 valuable lessons about personal finance for young adults..."}
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                />
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>{isVi ? "Ý tưởng của bạn sẽ được chuyển thành kịch bản ở bước sau." : "Your idea will be converted to a script in the next step."}</span>
                  <span>{form.prompt.length}/500</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {isVi ? "Kịch bản chi tiết AI sẽ đọc (tối thiểu 10 ký tự):" : "Detailed script the AI avatar will read (min 10 chars):"}
                </span>
                {form.prompt && (
                  <button
                    type="button"
                    onClick={generateDraftScript}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    {isVi ? "Đặt lại bản nháp AI" : "Regenerate AI Draft"}
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
                <span className="text-sm font-semibold text-zinc-200">
                  {isVi ? "Chọn giọng đọc AI" : "Choose AI Voice"}
                </span>
                <div className="group relative">
                  <HelpCircle className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex w-48 rounded bg-zinc-950 border border-white/10 p-2 text-[10px] text-zinc-300 shadow-xl z-20">
                    {isVi 
                      ? "Chọn giọng đọc tiếng Anh hoặc tiếng Việt phù hợp với phong cách thương hiệu." 
                      : "Select the AI voice profile to read your generated video script."}
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
                  <span className="text-sm font-semibold text-zinc-200">{isVi ? "1. Chọn Người đại diện (Avatar)" : "1. Choose Presenter Avatar"}</span>
                  <div className="group relative">
                    <HelpCircle className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex w-48 rounded bg-zinc-950 border border-white/10 p-2 text-[10px] text-zinc-300 shadow-xl z-20">
                      {isVi 
                        ? "Chọn người đại diện kỹ thuật số (AI Avatar) để thể hiện thương hiệu hoặc chủ đề của bạn." 
                        : "Select the digital twin avatar representing your brand or topic."}
                    </span>
                  </div>
                </div>
                <VideoAvatarPicker
                  value={form.avatarId}
                  onChange={(id) => updateField('avatarId', id)}
                />
              </div>
              <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-200">{isVi ? "2. Chọn Bố cục mẫu" : "2. Choose Layout Template"}</span>
                  <div className="group relative">
                    <HelpCircle className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex w-48 rounded bg-zinc-950 border border-white/10 p-2 text-[10px] text-zinc-300 shadow-xl z-20">
                      {isVi 
                        ? "Chọn bố cục kịch bản phim ảnh (Cinematic) hoặc phong cách tự nhiên (Casual) để tối ưu hiển thị." 
                        : "Choose between cinematic or casual templates to customize the visual theme."}
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
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                <h4 className="font-bold text-xs text-violet-400 uppercase tracking-wider">{isVi ? "Tóm tắt cấu hình" : "Review Selections"}</h4>
                <div className="space-y-2 text-xs md:text-sm">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-zinc-400">{isVi ? "Người đại diện" : "Avatar"}:</span>
                    <span className="font-medium text-white">{form.avatarId}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-zinc-400">{isVi ? "Giọng nói" : "Voice"}:</span>
                    <span className="font-medium text-white">{form.voiceId}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-zinc-400">{isVi ? "Bố cục mẫu" : "Template"}:</span>
                    <span className="font-medium text-white capitalize">{form.template}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-zinc-400">{isVi ? "Nội dung kịch bản" : "Script Content"}:</span>
                    <p className="bg-black/40 border border-white/5 p-3 rounded-lg text-xs font-mono text-zinc-300 max-h-[80px] overflow-y-auto">
                      {form.script || (isVi ? "(Trống)" : "(Empty)")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Controls */}
        <div className="mt-6 flex justify-between gap-3 border-t border-white/5 pt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs md:text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              {isVi ? "Quay lại" : "Back"}
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-5 py-2 text-xs md:text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {isVi ? "Tiếp theo" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit || isPending}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 px-6 py-2 text-xs md:text-sm font-bold text-white transition disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? t('video.generating') : t('video.generate')}
            </button>
          )}
        </div>
      </form>

      {/* Live Preview Sidebar */}
      <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-xl">
          <div className="aspect-video bg-[radial-gradient(circle_at_25%_25%,hsl(var(--primary)/0.15),transparent_40%),linear-gradient(135deg,rgba(15,15,20,0.9),rgba(20,10,35,0.9))] p-4 relative">
            <div className="flex h-full flex-col justify-between rounded-lg border border-white/10 bg-zinc-900/60 backdrop-blur-md p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">
                    {t('video.previewLabel')}
                  </p>
                  <p className="mt-1 text-xs md:text-sm font-semibold text-zinc-100 line-clamp-1">
                    {form.prompt ? `"${form.prompt}"` : t('video.previewPlaceholder')}
                  </p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-500/30">
                  <Film className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>

              {/* Dynamic Mock Avatar Frame */}
              <div className="my-2 flex flex-col items-center justify-center border border-dashed border-white/10 rounded p-2 bg-black/40 text-center">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Presenting Avatar</span>
                <span className="text-xs font-semibold text-cyan-400 mt-0.5">{form.avatarId}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`rounded border p-1.5 transition-colors duration-200 ${step === 2 ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 bg-white/[0.02]'}`}>
                  <p className="text-[9px] font-medium text-zinc-400">
                    {isVi ? "Kịch bản" : "Script"}
                  </p>
                  <p className="text-[10px] font-bold text-white truncate">
                    {form.script ? `${form.script.length} chars` : "-"}
                  </p>
                </div>
                <div className={`rounded border p-1.5 transition-colors duration-200 ${step === 3 ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 bg-white/[0.02]'}`}>
                  <p className="text-[9px] font-medium text-zinc-400">
                    {isVi ? "Giọng nói" : "Voice"}
                  </p>
                  <p className="text-[10px] font-bold text-white truncate">
                    {form.voiceId}
                  </p>
                </div>
                <div className={`rounded border p-1.5 transition-colors duration-200 ${step === 4 ? 'border-violet-500 bg-violet-500/10' : 'border-white/5 bg-white/[0.02]'}`}>
                  <p className="text-[9px] font-medium text-zinc-400">
                    {isVi ? "Mẫu" : "Template"}
                  </p>
                  <p className="text-[10px] font-bold text-white truncate capitalize">
                    {form.template}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {missionId && (
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-zinc-900/40 p-4 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">{t('video.missionCreated')}</p>
            </div>
            <p className="text-xs text-muted-foreground font-mono bg-black/25 p-2 rounded border border-white/5">{missionId}</p>
            <Link
              href="/dashboard/videos"
              className="mt-1 inline-flex w-fit cursor-pointer text-xs font-medium text-violet-400 hover:text-violet-300 underline underline-offset-2"
            >
              {t('video.trackProgress')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
