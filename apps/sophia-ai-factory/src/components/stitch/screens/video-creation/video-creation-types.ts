/**
 * Types, constants for the Video Creation page.
 * @module components/stitch/screens/video-creation/video-creation-types
 */

import { FileText, Mic, Film, Eye } from 'lucide-react';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface VideoCreationPageProps {
  /** Initial script content */
  initialScript?: string;
  /** Current step (1-based, defaults to 1 = Script) */
  currentStep?: number;
  /** Callback when user clicks Continue */
  onContinue?: () => void;
  /** Callback when user clicks Back */
  onBack?: () => void;
  /** Callback when user clicks AI Generate */
  onAIGenerate?: (script: string) => void;
}

/* ── Constants ───────────────────────────────────────────────────────────── */

export const MAX_CHARS = 5000;

export const STEPS = [
  { id: 1, key: 'script', Icon: FileText },
  { id: 2, key: 'voice', Icon: Mic },
  { id: 3, key: 'visual', Icon: Film },
  { id: 4, key: 'review', Icon: Eye },
] as const;

export const VOICE_OPTIONS = ['aria', 'marcus', 'sophia', 'nova'] as const;

export const VISUAL_STYLES = [
  {
    id: 'cinematic',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAF8Xgl8ZhCH1k3nzBb-Y81eMaLvYxSwbpUFtCvm7LULuoGcP_ptv9895uo-PpT85xDqwU_giF60-lHlEf8CXt-uSbEOvHEjFG1sLYEf-ue22GvKKrKz12YdvTQrV1BBmL6-KPuo6zZFNtwk-XlTgU1wTNti6B2wSPYsQpQug9RThUkIOLK4dBQaQEKGpXqJ5jOty1kV0OMAUQ57QfFKYQWeiuol86mFH2Bo9QA5SeMxrA4noOEDEz1fxm3BpcJHdK59Q24Wf7q-QQ',
  },
  {
    id: 'template',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDnGaalII0NvHAxDhIZQqr2Y9Cz69dKxQ-n6WZIoDxWhWQbkLDPzZdGENsCl-wWrR4lTeg0R-_gw8USc25Us41xS7mLCRTX7svzDhisx9yQN0AAelFoWESeW32N7z-hyXCGkDobOzMTqDH01AuJS5EaAyhfyYr7sYQ1iztKR9u8_Y3I0Zsuy15ypqENz8uIsvj0_wzCWc1Pzl3T0i6D1EKdsYTeu9HFvPhINRyhitJY5GeL5-X_ETBVDr_-qpI6d5OfXnUuG2XjKOA',
  },
] as const;
