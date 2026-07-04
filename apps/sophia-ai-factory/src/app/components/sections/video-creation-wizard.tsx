'use client';

import {
  useState,
  useCallback,
  Fragment,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/seed/components/ui/button';
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
  Copy,
  History,
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
  { id: 1, label: 'Script', shortLabel: 'Script' },
  { id: 2, label: 'Voice', shortLabel: 'Voice' },
  { id: 3, label: 'Visual', shortLabel: 'Visual' },
  { id: 4, label: 'Review', shortLabel: 'Review' },
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

const GENERATED_SCRIPT = [
  { heading: '[Intro: Urban Cityscape - Night]', text: 'The city never sleeps. In the heart of Neo-Tokyo, the lights of a thousand neon signs reflect off the rainy pavement.' },
  { heading: '[Scene 1: Interior - High-Tech Laboratory]', text: 'The blue glow of holographic displays illuminates the room. Data streams cascade across transparent screens.' },
  { heading: '[Narrator Voice]', text: 'Experience the next evolution of storytelling. Where your imagination meets the power of Sophia AI.' },
];

/* ──────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────── */

function StepCircle({
  step,
  currentStep,
}: {
  step: StepId;
  currentStep: StepId;
}) {
  const isCompleted = currentStep > step;
  const isActive = currentStep === step;

  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
        isActive &&
          'bg-primary text-on-primary shadow-[0_0_15px_rgba(195,195,238,0.3)]',
        isCompleted && 'bg-primary/20 text-primary',
        !isActive && !isCompleted && 'bg-surface-container-highest text-on-surface-variant border border-outline-variant',
      )}
      aria-current={isActive ? 'step' : undefined}
    >
      {isCompleted ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <span>{step}</span>
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
        'hidden text-sm font-bold md:inline',
        currentStep >= step ? 'text-primary' : 'text-on-surface-variant',
      )}
    >
      {label}
    </span>
  );
}

function StepConnector() {
  return (
    <div className="h-px flex-1 min-w-[24px] bg-outline-variant" aria-hidden="true" />
  );
}

/* ──────────────────────────────────────────────────────────────────
   Step Indicator
   ────────────────────────────────────────────────────────────────── */

function StepIndicator({ currentStep }: { currentStep: StepId }) {
  return (
    <nav
      className="mb-6 flex items-center gap-0 md:gap-1"
      aria-label="Video creation progress"
    >
      {STEPS.map((s, idx) => (
        <Fragment key={s.id}>
          <div className="flex items-center gap-2">
            <StepCircle step={s.id} currentStep={currentStep} />
            <StepLabel step={s.id} currentStep={currentStep} label={s.label} />
          </div>
          {idx < STEPS.length - 1 && <StepConnector />}
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
  const percent = Math.min((charCount / MAX_CHARS) * 100, 100);

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
    <section className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="text-base font-bold text-on-surface">Script Input</h3>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleAiGenerate}
          className="bg-surface-container-highest text-primary border border-primary/30 rounded-lg font-bold hover:bg-primary/10 transition-colors px-4 py-2 h-auto"
        >
          <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
          AI Generate
        </Button>
      </div>

      {/* Textarea */}
      <div className="px-4 py-4 relative group">
        <textarea
          value={script}
          onChange={handleTextChange}
          placeholder="Describe your video topic or paste a script..."
          rows={6}
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none resize-none text-sm leading-relaxed scrollbar-thin"
          aria-label="Video script"
        />
        <div className="absolute bottom-7 right-7 text-[10px] text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded border border-outline-variant">
          Markdown supported
        </div>
      </div>

      {/* Character Count */}
      <div className="px-4 pb-3">
        <div className="flex justify-between text-xs text-on-surface-variant mb-1">
          <span>Character count</span>
          <span className={cn(charCount > MAX_CHARS ? 'text-error font-medium' : 'text-on-surface')}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              charCount > MAX_CHARS ? 'bg-error' : 'bg-primary',
            )}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>

      {/* Generated Script Preview */}
      <div className="border-t border-outline-variant px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Generated Script Preview
          </h4>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="Copy script"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="History"
            >
              <History className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 max-h-64 overflow-y-auto space-y-3 text-sm leading-relaxed text-on-surface/80 custom-scrollbar">
          {GENERATED_SCRIPT.map((section, idx) => (
            <div key={idx}>
              <p className="font-bold text-primary mb-1">{section.heading}</p>
              <p>{section.text}</p>
            </div>
          ))}
        </div>
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
    <section className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 border-b border-outline-variant px-4 py-4">
        <Mic className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="text-base font-bold text-on-surface">Choose a Voice</h3>
      </div>

      <div className="p-4 space-y-3" role="radiogroup" aria-label="Voice options">
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
                'flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all duration-200',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant bg-surface-container-low hover:border-outline',
              )}
            >
              {/* Initial avatar */}
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  isSelected
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-surface-container-highest text-on-surface-variant',
                )}
              >
                {voice.name.charAt(0)}
              </div>

              {/* Voice details */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-bold',
                    isSelected ? 'text-on-surface' : 'text-on-surface',
                  )}
                >
                  {voice.name}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {voice.accent} &middot; {voice.gender}
                </p>
              </div>

              {/* Radio indicator */}
              <div
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isSelected ? 'border-primary' : 'border-outline-variant',
                )}
              >
                {isSelected && (
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </div>

              {/* Preview button */}
              <button
                type="button"
                onClick={(e) => handlePlayPreview(e, voice.id)}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                  isPlaying
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant hover:bg-primary-container hover:text-on-primary-container',
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
}[] = [
  {
    id: 'cinematic',
    title: 'Cinematic',
    description: 'Full cinematic production with transitions and effects.',
  },
  {
    id: 'template',
    title: 'Template',
    description: 'Use a pre-built template with drag-and-drop editing.',
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
    <section className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 border-b border-outline-variant px-4 py-4">
        <ImageIcon className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="text-base font-bold text-on-surface">Choose Visual Style</h3>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {VISUAL_STYLES.map((style) => {
          const isSelected = selected === style.id;
          const Icon = style.id === 'cinematic' ? Film : Layout;

          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onSelect(style.id)}
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border p-6 text-center transition-all duration-200',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-outline-variant bg-surface-container-low hover:border-outline',
              )}
              aria-pressed={isSelected}
            >
              <div
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-xl transition-all',
                  isSelected
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-highest text-on-surface-variant',
                )}
              >
                <Icon className="h-8 w-8" aria-hidden="true" />
              </div>

              <div>
                <p
                  className={cn(
                    'text-base font-bold',
                    isSelected ? 'text-on-surface' : 'text-on-surface',
                  )}
                >
                  {style.title}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {style.description}
                </p>
              </div>

              {isSelected && (
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
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
    <section className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 border-b border-outline-variant px-4 py-4">
        <Eye className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="text-base font-bold text-on-surface">Review Your Project</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Script summary */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-on-surface-variant">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Script
            <span className="ml-auto text-xs text-outline">
              {script.length.toLocaleString()} characters
            </span>
          </div>
          <p className="text-sm leading-relaxed text-on-surface/80">
            {scriptPreview || (
              <span className="italic text-outline">No script written</span>
            )}
          </p>
        </div>

        {/* Voice summary */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
            <Mic className="h-4 w-4" aria-hidden="true" />
            Voice
          </div>
          {selectedVoice ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container">
                {selectedVoice.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">
                  {selectedVoice.name}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {selectedVoice.accent} &middot; {selectedVoice.gender}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm italic text-outline">
              No voice selected
            </p>
          )}
        </div>

        {/* Visual style summary */}
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            Visual Style
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface-variant">
              {visualStyle === 'cinematic' ? (
                <Film className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Layout className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">
                {visualStyle === 'cinematic' ? 'Cinematic' : 'Template'}
              </p>
              <p className="text-xs text-on-surface-variant">
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
      className="w-full xl:w-80 shrink-0 flex flex-col gap-4"
      aria-label="Video preview"
    >
      {/* Video Preview Card */}
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm">
        {/* Thumbnail */}
        <div className="relative aspect-video group cursor-pointer bg-surface-container-low overflow-hidden">
          <div className="flex flex-col items-center justify-center h-full gap-2 text-outline">
            <Monitor className="h-10 w-10" aria-hidden="true" />
            <span className="text-xs font-medium">Preview</span>
          </div>
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-primary/90 text-on-primary flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="h-6 w-6 ml-0.5" aria-hidden="true" />
            </div>
          </div>
          {/* Duration badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[10px] text-white font-bold uppercase tracking-wider backdrop-blur-sm">
            <Clock className="h-3 w-3" aria-hidden="true" />
            3:24
          </div>
        </div>

        {/* Details */}
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-bold text-on-surface">Video Preview</h3>

          {/* Voice Preview */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Voice Preview
            </label>
            <div className="flex items-center justify-between p-2.5 bg-surface-container-low border border-outline-variant rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center">
                  <Volume2 className="h-4 w-4 text-on-secondary-container" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none text-on-surface">
                    {selectedVoice?.name ?? 'Not set'}
                  </p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {selectedVoice?.accent ?? 'Select a voice'}
                  </p>
                </div>
              </div>
            </div>
            {/* Play bar */}
            <div className="flex items-center gap-3 bg-primary-container/20 p-2 rounded-lg border border-primary/20">
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary shrink-0"
                aria-label="Preview voice"
              >
                <Play className="h-4 w-4 ml-0.5" />
              </button>
              <div className="flex-1 h-1 bg-surface-variant rounded-full overflow-hidden relative">
                <div className="absolute inset-0 bg-primary/40 w-1/3 rounded-full" />
              </div>
            </div>
          </div>

          {/* Visual Style */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Visual Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div
                className={cn(
                  'relative rounded-lg border-2 p-2 cursor-pointer transition-all',
                  visualStyle === 'cinematic'
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant bg-surface-container-low hover:border-outline',
                )}
              >
                <div className="h-12 w-full rounded bg-surface-container-highest mb-1 flex items-center justify-center">
                  <Film className="h-5 w-5 text-outline" />
                </div>
                <p className="text-[10px] font-bold text-center text-on-surface">
                  Cinematic
                </p>
                {visualStyle === 'cinematic' && (
                  <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                    <Check className="h-2.5 w-2.5 text-on-primary font-bold" />
                  </div>
                )}
              </div>
              <div
                className={cn(
                  'relative rounded-lg border-2 p-2 cursor-pointer transition-all',
                  visualStyle === 'template'
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant bg-surface-container-low hover:border-outline',
                )}
              >
                <div className="h-12 w-full rounded bg-surface-container-highest mb-1 flex items-center justify-center">
                  <Layout className="h-5 w-5 text-outline" />
                </div>
                <p className="text-[10px] font-bold text-center text-on-surface-variant">
                  Template
                </p>
                {visualStyle === 'template' && (
                  <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                    <Check className="h-2.5 w-2.5 text-on-primary font-bold" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-primary text-sm">
          <span className="text-xs">Autosaved at 14:02</span>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Your script is being analyzed for optimal visual generation based on your selected style.
        </p>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Bottom Action Bar
   ────────────────────────────────────────────────────────────────── */

const STEP_ICONS = [
  { icon: FileText, label: 'Script' },
  { icon: Mic, label: 'Voice' },
  { icon: Film, label: 'Visual' },
  { icon: Eye, label: 'Review' },
];

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
    <div className="sticky bottom-0 left-0 right-0 z-10 border-t border-outline-variant bg-surface-container-high px-6 py-4 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={isFirstStep}
          className={cn(
            'text-on-surface-variant hover:text-on-surface transition-colors font-bold',
            isFirstStep && 'opacity-0 pointer-events-none',
          )}
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Back
        </Button>

        {/* Step icons - hidden on mobile */}
        <div className="hidden sm:flex items-center gap-8">
          {STEP_ICONS.map((s, idx) => {
            const stepNum = (idx + 1) as StepId;
            const Icon = s.icon;
            const isCurrent = currentStep === stepNum;
            return (
              <div
                key={s.label}
                className={cn(
                  'flex flex-col items-center gap-1 transition-all duration-300',
                  isCurrent
                    ? 'opacity-100'
                    : 'opacity-40',
                )}
              >
                <span
                  className={cn(
                    isCurrent ? 'text-primary' : 'text-on-surface-variant',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-label font-medium uppercase tracking-widest text-on-surface-variant">
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="bg-primary text-on-primary px-8 py-2.5 rounded-xl font-black shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('cinematic');

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
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row min-h-screen bg-background">
      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="space-y-1 mb-6">
          <h1 className="text-[28px] font-bold text-on-surface font-headline leading-tight">
            Create New Video
          </h1>
          <p className="text-on-surface-variant text-sm">
            Transform your ideas into high-quality cinematic content with AI.
          </p>
        </div>
        <StepIndicator currentStep={step} />
        <div className="flex-1">{renderStepContent()}</div>
        {/* Spacer for sticky action bar */}
        <div className="h-24 lg:h-20" />
      </div>

      {/* Right sidebar — hidden below xl breakpoint */}
      <div className="hidden xl:block">
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
