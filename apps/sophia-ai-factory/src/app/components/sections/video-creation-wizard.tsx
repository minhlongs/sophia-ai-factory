'use client';

import {
  useState,
  useCallback,
  Fragment,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/seed/components/ui/button';
import { Textarea } from '@/seed/components/ui/textarea';
import { cn } from '@/seed/utils/cn';
import {
  Sparkles,
  Check,
  FileText,
  Mic,
  ImageIcon,
  Eye,
  ChevronLeft,
  ChevronRight,
  Play,
  Volume2,
  Film,
  Layout,
  Clock,
  Monitor,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────── */

type StepId = 1 | 2 | 3 | 4;
type VisualStyle = 'template' | 'cinematic';

interface StepMeta {
  id: StepId;
  label: string;
  shortLabel: string;
  icon: typeof FileText;
}

interface VoiceOption {
  id: string;
  name: string;
  accent: string;
  gender: string;
}

/* ──────────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────────── */

const STEPS: StepMeta[] = [
  { id: 1, label: 'Script', shortLabel: 'Script', icon: FileText },
  { id: 2, label: 'Voice', shortLabel: 'Voice', icon: Mic },
  { id: 3, label: 'Visual', shortLabel: 'Visual', icon: ImageIcon },
  { id: 4, label: 'Review', shortLabel: 'Review', icon: Eye },
];

const VOICES: VoiceOption[] = [
  { id: 'voice-1', name: 'Anna', accent: 'US English', gender: 'Female' },
  { id: 'voice-2', name: 'James', accent: 'UK English', gender: 'Male' },
  { id: 'voice-3', name: 'Linh', accent: 'Vietnamese', gender: 'Female' },
  { id: 'voice-4', name: 'Minh', accent: 'Vietnamese', gender: 'Male' },
];

const MAX_CHARS = 5000;

const NEXT_LABELS: Record<StepId, string> = {
  1: 'Continue to Voice',
  2: 'Continue to Visual',
  3: 'Continue to Review',
  4: 'Start Generation',
};

/* ──────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────── */

function StepCircle({
  step,
  currentStep,
  stepMeta,
}: {
  step: StepId;
  currentStep: StepId;
  stepMeta: StepMeta;
}) {
  const isCompleted = currentStep > step;
  const isActive = currentStep === step;
  const Icon = stepMeta.icon;

  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all duration-300',
        isActive && 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25',
        isCompleted && 'bg-indigo-500/20 text-indigo-400',
        !isActive && !isCompleted && 'bg-zinc-800 text-zinc-500',
      )}
      aria-current={isActive ? 'step' : undefined}
    >
      {isCompleted ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Icon className="h-4 w-4" aria-hidden="true" />
      )}
    </div>
  );
}

function StepLabel({
  step,
  currentStep,
  label,
}: {
  step: StepId;
  currentStep: StepId;
  label: string;
}) {
  return (
    <span
      className={cn(
        'hidden text-sm font-medium md:inline',
        currentStep >= step ? 'text-white' : 'text-zinc-500',
      )}
    >
      {label}
    </span>
  );
}

function StepConnector({
  isActive,
}: {
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        'h-px flex-1 min-w-[24px] transition-colors duration-300',
        isActive ? 'bg-indigo-500' : 'bg-zinc-800',
      )}
      aria-hidden="true"
    />
  );
}

/* ──────────────────────────────────────────────────────────────────
   Step Indicator
   ────────────────────────────────────────────────────────────────── */

function StepIndicator({ currentStep }: { currentStep: StepId }) {
  return (
    <nav
      className="mb-8 flex items-center gap-0 md:gap-1"
      aria-label="Video creation progress"
    >
      {STEPS.map((s, idx) => (
        <Fragment key={s.id}>
          <div className="flex items-center gap-2">
            <StepCircle step={s.id} currentStep={currentStep} stepMeta={s} />
            <StepLabel step={s.id} currentStep={currentStep} label={s.label} />
          </div>
          {idx < STEPS.length - 1 && (
            <StepConnector isActive={currentStep > s.id} />
          )}
        </Fragment>
      ))}
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Step 1 — Script
   ────────────────────────────────────────────────────────────────── */

function ScriptStep({
  script,
  onChange,
}: {
  script: string;
  onChange: (value: string) => void;
}) {
  const charCount = script.length;

  const handleTextChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      if (e.target.value.length <= MAX_CHARS) {
        onChange(e.target.value);
      }
    },
    [onChange],
  );

  const handleAiGenerate = useCallback(() => {
    // Placeholder: triggers AI generation flow
  }, []);

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-white">
        Write your script
      </h2>
      <p className="mb-4 text-sm text-zinc-400">
        Write your video script or use AI to generate one.
      </p>

      <div className="relative">
        <Textarea
          value={script}
          onChange={handleTextChange}
          placeholder="Enter your script here..."
          rows={6}
          className="min-h-[150px] resize-y border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500"
          aria-label="Video script"
        />
        <div className="pointer-events-none absolute bottom-3 right-3 text-xs text-zinc-500">
          {charCount.toLocaleString()}/{MAX_CHARS.toLocaleString()}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAiGenerate}
          className="border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
        >
          <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
          AI Generate
        </Button>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Step 2 — Voice
   ────────────────────────────────────────────────────────────────── */

function VoiceStep({
  selectedVoice,
  onSelect,
}: {
  selectedVoice: string;
  onSelect: (id: string) => void;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  const handlePlayPreview = useCallback(
    (e: React.MouseEvent, voiceId: string) => {
      e.stopPropagation();
      setPlayingId((prev) => (prev === voiceId ? null : voiceId));
    },
    [],
  );

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-white">
        Choose a voice
      </h2>
      <p className="mb-4 text-sm text-zinc-400">
        Select a voice for your video narration.
      </p>

      <div className="space-y-3" role="radiogroup" aria-label="Voice options">
        {VOICES.map((voice) => {
          const isSelected = selectedVoice === voice.id;
          const isPlaying = playingId === voice.id;

          return (
            <div
              key={voice.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onSelect(voice.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(voice.id);
                }
              }}
              className={cn(
                'flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-all duration-200',
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700',
              )}
            >
              {/* Avatar placeholder */}
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  isSelected
                    ? 'bg-indigo-500 text-white'
                    : 'bg-zinc-800 text-zinc-400',
                )}
              >
                {voice.name.charAt(0)}
              </div>

              {/* Voice details */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    isSelected ? 'text-white' : 'text-zinc-300',
                  )}
                >
                  {voice.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {voice.accent} &middot; {voice.gender}
                </p>
              </div>

              {/* Radio indicator */}
              <div
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isSelected
                    ? 'border-indigo-500'
                    : 'border-zinc-700',
                )}
              >
                {isSelected && (
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                )}
              </div>

              {/* Preview button */}
              <button
                type="button"
                onClick={(e) => handlePlayPreview(e, voice.id)}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                  isPlaying
                    ? 'bg-indigo-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white',
                )}
                aria-label={`Preview ${voice.name} voice`}
              >
                {isPlaying ? (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" aria-hidden="true" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Step 3 — Visual
   ────────────────────────────────────────────────────────────────── */

const VISUAL_STYLES: {
  id: VisualStyle;
  title: string;
  description: string;
  icon: typeof Layout;
}[] = [
  {
    id: 'template',
    title: 'Template',
    description: 'Use a pre-built template with drag-and-drop editing.',
    icon: Layout,
  },
  {
    id: 'cinematic',
    title: 'Cinematic',
    description: 'Full cinematic production with transitions and effects.',
    icon: Film,
  },
];

function VisualStep({
  selected,
  onSelect,
}: {
  selected: VisualStyle;
  onSelect: (style: VisualStyle) => void;
}) {
  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-white">
        Choose visual style
      </h2>
      <p className="mb-4 text-sm text-zinc-400">
        Select how your video will look.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {VISUAL_STYLES.map((style) => {
          const isSelected = selected === style.id;
          const Icon = style.icon;

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onSelect(style.id)}
              className={cn(
                'flex flex-col items-center gap-3 rounded-lg border p-8 text-center transition-all duration-200',
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700',
              )}
              aria-pressed={isSelected}
            >
              <div
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-xl transition-colors',
                  isSelected
                    ? 'bg-indigo-500 text-white'
                    : 'bg-zinc-800 text-zinc-400',
                )}
              >
                <Icon className="h-8 w-8" aria-hidden="true" />
              </div>

              <div>
                <p
                  className={cn(
                    'text-base font-semibold',
                    isSelected ? 'text-white' : 'text-zinc-300',
                  )}
                >
                  {style.title}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {style.description}
                </p>
              </div>

              {isSelected && (
                <div className="flex items-center gap-1 text-xs font-medium text-indigo-400">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Selected
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Step 4 — Review
   ────────────────────────────────────────────────────────────────── */

function ReviewStep({
  script,
  voiceId,
  visualStyle,
}: {
  script: string;
  voiceId: string;
  visualStyle: VisualStyle;
}) {
  const selectedVoice = VOICES.find((v) => v.id === voiceId);
  const scriptPreview =
    script.length > 200 ? `${script.slice(0, 200)}...` : script;

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-white">
        Review your project
      </h2>
      <p className="mb-6 text-sm text-zinc-400">
        Confirm all settings before generating your video.
      </p>

      <div className="space-y-4">
        {/* Script summary */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-400">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Script
            <span className="ml-auto text-xs text-zinc-600">
              {script.length.toLocaleString()} characters
            </span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">
            {scriptPreview || (
              <span className="italic text-zinc-600">No script written</span>
            )}
          </p>
        </div>

        {/* Voice summary */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
            <Mic className="h-4 w-4" aria-hidden="true" />
            Voice
          </div>
          {selectedVoice ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-400">
                {selectedVoice.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedVoice.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {selectedVoice.accent} &middot; {selectedVoice.gender}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm italic text-zinc-600">
              No voice selected
            </p>
          )}
        </div>

        {/* Visual style summary */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            Visual Style
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
              {visualStyle === 'cinematic' ? (
                <Film className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Layout className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {visualStyle === 'cinematic' ? 'Cinematic' : 'Template'}
              </p>
              <p className="text-xs text-zinc-500">
                {visualStyle === 'cinematic'
                  ? 'Full cinematic production'
                  : 'Pre-built template'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Preview Panel (Sidebar)
   ────────────────────────────────────────────────────────────────── */

function PreviewPanel({
  visualStyle,
  voiceId,
}: {
  visualStyle: VisualStyle;
  voiceId: string;
}) {
  const selectedVoice = VOICES.find((v) => v.id === voiceId);

  return (
    <aside
      className="w-full lg:w-[320px] shrink-0"
      aria-label="Video preview"
    >
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        {/* Thumbnail area */}
        <div className="relative aspect-video bg-zinc-800/80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-zinc-600">
            <Monitor className="h-10 w-10" aria-hidden="true" />
            <span className="text-xs font-medium">Preview</span>
          </div>

          {/* Duration badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs text-zinc-300">
            <Clock className="h-3 w-3" aria-hidden="true" />
            3:24
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 p-4">
          <h3 className="text-sm font-semibold text-white">Video Preview</h3>

          <div className="space-y-2 text-sm">
            {/* Voice style */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Voice</span>
              <span className="text-zinc-300">
                {selectedVoice?.name ?? 'Not set'}
              </span>
            </div>

            {/* Visual style */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Style</span>
              <span className="capitalize text-zinc-300">{visualStyle}</span>
            </div>

            {/* Duration */}
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Duration</span>
              <span className="text-zinc-300">3:24</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Bottom Action Bar
   ────────────────────────────────────────────────────────────────── */

function ActionBar({
  currentStep,
  onBack,
  onNext,
  canContinue,
}: {
  currentStep: StepId;
  onBack: () => void;
  onNext: () => void;
  canContinue: boolean;
}) {
  const isFirstStep = currentStep === 1;
  const nextLabel = NEXT_LABELS[currentStep];

  return (
    <div
      className="sticky bottom-0 left-0 right-0 z-10 border-t border-zinc-800 bg-[#18181B] px-6 py-4"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isFirstStep}
          className={cn(
            'text-zinc-400 hover:text-white',
            isFirstStep && 'opacity-0 pointer-events-none',
          )}
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        <Button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {nextLabel}
          {currentStep < 4 && (
            <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────────────────────────── */

export default function VideoCreationWizard() {
  const [step, setStep] = useState<StepId>(1);
  const [script, setScript] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('template');

  const canContinue =
    step === 1 ? script.trim().length > 0 : step === 4 || true;

  const handleNext = useCallback(() => {
    if (step < 4) {
      setStep((prev) => (prev + 1) as StepId);
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as StepId);
    }
  }, [step]);

  const renderStepContent = (): ReactNode => {
    switch (step) {
      case 1:
        return <ScriptStep script={script} onChange={setScript} />;
      case 2:
        return (
          <VoiceStep
            selectedVoice={selectedVoice}
            onSelect={setSelectedVoice}
          />
        );
      case 3:
        return <VisualStep selected={visualStyle} onSelect={setVisualStyle} />;
      case 4:
        return (
          <ReviewStep
            script={script}
            voiceId={selectedVoice}
            visualStyle={visualStyle}
          />
        );
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <StepIndicator currentStep={step} />
        <div className="flex-1">{renderStepContent()}</div>
        {/* Spacer for sticky action bar */}
        <div className="h-24 lg:h-20" />
      </div>

      {/* Right sidebar — hidden below lg breakpoint */}
      <div className="hidden lg:block">
        <PreviewPanel visualStyle={visualStyle} voiceId={selectedVoice} />
      </div>

      {/* Bottom action bar — fixed at the bottom */}
      <ActionBar
        currentStep={step}
        onBack={handleBack}
        onNext={handleNext}
        canContinue={canContinue}
      />
    </div>
  );
}
