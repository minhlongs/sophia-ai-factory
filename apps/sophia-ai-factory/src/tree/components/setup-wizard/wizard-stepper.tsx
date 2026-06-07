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
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        {/* Connecting Line */}
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-muted -z-10 rounded-full" />
        <div
          className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div key={index} className="flex flex-col items-center gap-2 bg-background px-2 rounded-lg relative">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ease-in-out min-w-[44px]',
                  isCompleted
                    ? 'bg-primary border-primary text-primary-foreground shadow-md'
                    : isCurrent
                      ? 'bg-background border-primary text-primary ring-2 ring-primary/50'
                      : 'bg-muted border-border text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 stroke-[3px]" aria-hidden="true" />
                ) : (
                  <span className="font-semibold text-sm">{stepNum}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] md:text-xs font-semibold uppercase tracking-wider absolute top-12 whitespace-nowrap transition-colors duration-300',
                  isCurrent
                    ? 'text-foreground'
                    : isCompleted
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                )}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-6" /> {/* Spacer for labels */}
    </div>
  );
}
