// i18n-namespace: campaign
'use client';

import {
  PIPELINE_STEPS,
  getStepState,
  type CampaignPipelineTimelineProps,
} from './types';
import { StageStepItem } from './stage-step-item';

export function CampaignPipelineTimeline({
  currentStep,
  status,
}: CampaignPipelineTimelineProps) {
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.id === currentStep);
  const resolvedIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div
      role="list"
      aria-label="Campaign pipeline progress"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
        flexWrap: 'wrap',
        rowGap: 16,
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {PIPELINE_STEPS.map((step, index) => {
        const state = getStepState(
          step.id,
          currentStep,
          status,
          resolvedIndex,
          index,
        );
        const isLast = index === PIPELINE_STEPS.length - 1;

        return (
          <StageStepItem
            key={step.id}
            id={step.id}
            label={step.label}
            state={state}
            isLast={isLast}
            isCompletedConnector={index < resolvedIndex}
          />
        );
      })}
    </div>
  );
}

export default CampaignPipelineTimeline;
