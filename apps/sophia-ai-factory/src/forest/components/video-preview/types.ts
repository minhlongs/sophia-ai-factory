import type { Step } from "@/forest/components/progress/step-indicator";

export interface VideoPreviewProps {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  status: "draft" | "queued" | "processing_script" | "processing_video" | "completed" | "failed";
  progress?: number;
  errorMessage?: string | null;
  campaignId: string;
  /** When true, force static mode (skip SSE connection). */
  staticMode?: boolean;
}

export interface StreamEventLike {
  type: string;
  status?: string;
  finalStatus?: string;
  terminal?: boolean;
  progress?: number;
  label?: string;
  message?: string;
}

export const PIPELINE_STEPS: Step[] = [
  { id: 'script', label: 'Scripting', i18nKey: 'streaming.steps.script' },
  { id: 'tts', label: 'Text-to-Speech', i18nKey: 'streaming.steps.tts' },
  { id: 'visual', label: 'Visual Generation', i18nKey: 'streaming.steps.visual' },
  { id: 'compose', label: 'Compositing', i18nKey: 'streaming.steps.compose' },
  { id: 'publish', label: 'Publishing', i18nKey: 'streaming.steps.publish' },
];
