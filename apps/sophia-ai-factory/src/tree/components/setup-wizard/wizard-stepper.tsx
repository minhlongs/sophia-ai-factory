'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface WizardStepperProps {
  currentStep: number;
  steps: string[];
}

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function WizardStepper({ currentStep, steps }: WizardStepperProps) {
  const progressRatio = steps.length > 1 ? (currentStep - 1) / (steps.length - 1) : 0;

  return (
    <div className="w-full py-4 sm:py-6">
      <div className="relative">
        {/* Connecting Line */}
        <div className="absolute left-3.5 right-3.5 sm:left-5 sm:right-5 top-3.5 sm:top-5 -translate-y-1/2 h-0.5 sm:h-1 bg-muted rounded-full" />
        <div
          className="absolute left-3.5 sm:left-5 top-3.5 sm:top-5 -translate-y-1/2 h-0.5 sm:h-1 bg-primary rounded-full transition-all duration-300 ease-in-out"
          style={{
            width: steps.length > 1
              ? `calc(${progressRatio * 100}% - ${progressRatio > 0 ? (progressRatio * 16) : 0}px)`
              : '0%',
            maxWidth: 'calc(100% - 28px)',
          }}
        />

        {/* Steps Nodes */}
        <div className="flex items-start justify-between relative z-10">
          {steps.map((step, index) => {
            const stepNum = index + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <div key={index} className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={cn(
                    'w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ease-in-out bg-background shrink-0',
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                      : isCurrent
                        ? 'bg-background border-primary text-primary ring-2 ring-primary/40 font-bold'
                        : 'bg-muted/80 border-border text-muted-foreground'
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 sm:w-5 sm:h-5 stroke-[2.5px]" aria-hidden="true" />
                  ) : (
                    <span className="text-xs sm:text-sm font-semibold">{stepNum}</span>
                  )}
                </div>

                {/* Step label on tablet/desktop */}
                <span
                  className={cn(
                    'hidden sm:block text-[10px] md:text-xs font-semibold uppercase tracking-wider mt-2 text-center truncate max-w-[80px] transition-colors duration-300',
                    isCurrent
                      ? 'text-foreground'
                      : isCompleted
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/60'
                  )}
                  title={step}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Active Step Indicator (320px–639px) */}
      <div className="sm:hidden text-center mt-3 px-2">
        <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
          Step {currentStep} of {steps.length}:
        </span>{' '}
        <span className="text-xs font-bold text-foreground">
          {steps[currentStep - 1] ?? ''}
        </span>
      </div>
    </div>
  );
}

