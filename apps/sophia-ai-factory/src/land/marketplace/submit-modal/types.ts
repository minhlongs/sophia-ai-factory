import type { TargetPlatform, AspectRatio } from '@/tree/marketplace/types';

export interface TemplateSubmitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateCreated?: () => void;
}

export interface SubmissionFeedback {
  status: string;
  score?: number;
  feedback: string[];
  error?: string;
}

export interface SubmitFormData {
  title: string;
  description: string;
  niche: string;
  platform: TargetPlatform;
  aspectRatio: AspectRatio;
  hookStyle: string;
  scriptTemplate: string;
  visualStylePrompt: string;
  priceUsd: string;
}
