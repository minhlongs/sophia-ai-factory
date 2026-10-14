// i18n-namespace: campaign

export const PIPELINE_STEPS = [
  { id: 'notify-start', label: 'Notify Start' },
  { id: 'generate-script', label: 'Generate Script' },
  { id: 'generate-voiceover', label: 'Generate Voiceover' },
  { id: 'start-video', label: 'Start Video' },
  { id: 'poll-video', label: 'Poll Video' },
  { id: 'distribute', label: 'Distribute' },
  { id: 'finalize', label: 'Finalize' },
] as const;

export type StepId = (typeof PIPELINE_STEPS)[number]['id'];

export type StepState = 'completed' | 'current' | 'failed' | 'pending';

export interface CampaignPipelineTimelineProps {
  currentStep: string;
  status: 'processing' | 'completed' | 'failed';
}

export function getStepState(
  _stepId: StepId,
  _currentStep: string,
  status: 'processing' | 'completed' | 'failed',
  currentIndex: number,
  stepIndex: number,
): StepState {
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    return 'current';
  }
  return 'pending';
}
