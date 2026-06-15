/**
 * Shared types for script generation and preview.
 */

export interface ScriptScene {
  id: number;
  type: 'intro' | 'hook' | 'body' | 'cta' | 'outro';
  text: string;
  durationSec: number;
  visualHint: string;
}

export interface GeneratedScript {
  id: string;
  templateId: string;
  templateName: string;
  topic: string;
  brandName: string;
  tone: string;
  language: 'en' | 'vi';
  totalDurationSec: number;
  scenes: ScriptScene[];
  fullScript: string;
  wordCount: number;
  createdAt: string;
}
