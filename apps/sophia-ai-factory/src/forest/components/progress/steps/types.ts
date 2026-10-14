/**
 * Pipeline Step Indicator Type Definitions
 *
 * Layer: forest/components/progress/steps
 */

/** A single pipeline step definition. */
export interface Step {
  /** Stable identifier for the step (e.g. "script", "tts"). */
  id: string;
  /** Display label — used as fallback when no i18n key is provided. */
  label: string;
  /** Optional i18n key under `streaming.steps.<id>` for bilingual labels. */
  i18nKey?: string;
  /** Estimated seconds this step typically takes. Used to show time remaining. */
  estimatedDurationSec?: number;
}

export interface StepIndicatorProps {
  /** Ordered pipeline steps. */
  steps: Step[];
  /** Zero-based index of the currently active step. -1 means none active. */
  activeStep: number;
  /** Overall pipeline status. */
  status: 'active' | 'complete' | 'error';
  /** Optional human-readable status message from the stream. */
  statusMessage?: string;
  /** Progress percentage (0-100) for the overall pipeline or current step. */
  progress?: number;
  /** Estimated seconds remaining for the current step, if known. */
  estimatedRemainingSec?: number;
  /** Additional CSS class name. */
  className?: string;
}

export type StepState = 'pending' | 'active' | 'complete' | 'error';
