/**
 * Onboarding Checklist Component
 */

'use client';

import { useState, useEffect } from 'react';
import type { OnboardingStep } from '@/types/onboarding';
import { DEFAULT_ONBOARDING_STEPS, calculateProgress } from '@/lib/onboarding/config';

interface OnboardingChecklistProps {
  userId: string;
  orgId: string;
}

export function OnboardingChecklist({ userId, orgId }: OnboardingChecklistProps) {
  const [steps, setSteps] = useState<OnboardingStep[]>(DEFAULT_ONBOARDING_STEPS);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Load progress from backend
    const loadProgress = async () => {
      try {
        const response = await fetch(`/api/onboarding/progress?orgId=${orgId}`);
        const data = await response.json();
        if (data.steps) {
          setSteps(data.steps);
          setProgress(data.progress);
        }
      } catch (error) {
        console.error('Failed to load onboarding progress:', error);
      }
    };

    loadProgress();
  }, [orgId]);

  const handleStepComplete = async (stepId: string) => {
    const updatedSteps = steps.map((step) =>
      step.id === stepId ? { ...step, completed: true } : step
    );

    setSteps(updatedSteps);
    setProgress(calculateProgress(updatedSteps));

    try {
      await fetch('/api/onboarding/step/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          orgId,
          stepId,
          action: 'completed',
        }),
      });
    } catch (error) {
      console.error('Failed to complete step:', error);
    }
  };

  const handleSkipStep = async (stepId: string) => {
    const updatedSteps = steps.map((step) =>
      step.id === stepId ? { ...step, completed: true } : step
    );

    setSteps(updatedSteps);
    setProgress(calculateProgress(updatedSteps));

    try {
      await fetch('/api/onboarding/step/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          orgId,
          stepId,
        }),
      });
    } catch (error) {
      console.error('Failed to skip step:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Progress Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            Onboarding Checklist
          </h3>
          <span className="text-sm font-medium text-orange-600">
            {progress}% Complete
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-orange-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-start space-x-3 p-3 rounded-lg ${
              step.completed
                ? 'bg-green-50'
                : index === getNextIncompleteIndex(steps)
                ? 'bg-orange-50 border-2 border-orange-200'
                : 'bg-gray-50'
            }`}
          >
            {/* Icon */}
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                step.completed
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step.completed ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4
                className={`text-sm font-medium ${
                  step.completed ? 'text-green-800' : 'text-gray-900'
                }`}
              >
                {step.title}
              </h4>
              <p
                className={`text-xs mt-1 ${
                  step.completed ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                {step.description}
              </p>
            </div>

            {/* Action */}
            <div className="flex-shrink-0">
              {step.completed ? (
                <span className="text-xs text-green-600">Done</span>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => { if (step.action) { window.location.href = step.action.target; } }}
                    className="text-xs px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => handleSkipStep(step.id)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Completion Message */}
      {progress === 100 && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg text-center">
          <p className="text-green-800 font-medium">
            🎉 Onboarding complete! You're ready to go.
          </p>
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            className="mt-2 text-sm text-green-700 hover:text-green-900 underline"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}

function getNextIncompleteIndex(steps: OnboardingStep[]): number {
  const index = steps.findIndex((s) => !s.completed);
  return index === -1 ? steps.length : index;
}
