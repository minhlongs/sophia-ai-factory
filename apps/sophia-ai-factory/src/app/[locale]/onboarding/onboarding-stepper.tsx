'use client';
/**
 * Onboarding Stepper — progress dots + step body, client-side transitions.
 * @module app/[locale]/onboarding/onboarding-stepper
 */

import { useState } from 'react';
import { StepConnectivityCheck } from './steps/step-1-connectivity-check';
import { StepIssueApiKey } from './steps/step-2-issue-api-key';
import { StepFirstCallDemo } from './steps/step-3-first-call-demo';

interface CompletedSteps {
  connectivity: boolean;
  api_key: boolean;
  first_run: boolean;
}

interface OnboardingStepperProps {
  locale: string;
  initialStep: 1 | 2 | 3;
  completedSteps: CompletedSteps;
}

const STEPS = ['Connectivity', 'API Key', 'First Call'];

export function OnboardingStepper({ locale, initialStep, completedSteps }: OnboardingStepperProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(initialStep);
  const [done, setDone] = useState<CompletedSteps>(completedSteps);
  const isVi = locale.startsWith('vi');

  function handleStepComplete(step: keyof CompletedSteps) {
    setDone(prev => ({ ...prev, [step]: true }));
    if (step === 'connectivity') setCurrentStep(2);
    else if (step === 'api_key') setCurrentStep(3);
  }

  const allDone = done.connectivity && done.api_key && done.first_run;

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            {isVi ? 'Thiết lập Sophia AI' : 'Set up Sophia AI'}
          </h1>
          <p className="text-zinc-400 text-sm">
            {isVi ? 'Hoàn thành 3 bước để sử dụng đầy đủ tính năng' : 'Complete 3 steps to unlock full features'}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {STEPS.map((label, i) => {
            const stepNum = (i + 1) as 1 | 2 | 3;
            const stepKey: keyof CompletedSteps = (['connectivity', 'api_key', 'first_run'] as const)[i];
            const isActive = currentStep === stepNum;
            const isComplete = done[stepKey];
            return (
              <div key={stepNum} className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isComplete ? 'bg-emerald-500 text-white'
                    : isActive ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {isComplete ? '✓' : stepNum}
                </div>
                <span className={`text-xs ${isActive ? 'text-white' : 'text-zinc-500'}`}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Step body */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          {allDone ? (
            <AllDoneState locale={locale} />
          ) : (
            <>
              {currentStep === 1 && (
                <StepConnectivityCheck locale={locale} onComplete={() => handleStepComplete('connectivity')} />
              )}
              {currentStep === 2 && (
                <StepIssueApiKey locale={locale} onComplete={() => handleStepComplete('api_key')} />
              )}
              {currentStep === 3 && (
                <StepFirstCallDemo locale={locale} onComplete={() => handleStepComplete('first_run')} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AllDoneState({ locale }: { locale: string }) {
  const isVi = locale.startsWith('vi');
  return (
    <div className="text-center py-4">
      <div className="text-4xl mb-4">🎉</div>
      <h2 className="text-xl font-bold text-white mb-2">
        {isVi ? 'Hoàn thành!' : 'All done!'}
      </h2>
      <p className="text-zinc-400 mb-6">
        {isVi ? 'Sophia AI đã sẵn sàng phục vụ bạn.' : 'Sophia AI is ready to serve you.'}
      </p>
      <a
        href={`/${locale}/dashboard`}
        className="inline-block bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
      >
        {isVi ? 'Mở Dashboard' : 'Open Dashboard'}
      </a>
    </div>
  );
}
