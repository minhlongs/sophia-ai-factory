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
            <div key={index} className="flex flex-col items-center gap-2 bg-card px-2">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200",
                  isCompleted ? "bg-primary border-primary text-primary-foreground" :
                  isCurrent ? "bg-card border-primary text-primary ring-4 ring-primary/20" :
                  "bg-card border-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <span className="font-semibold">{stepNum}</span>
                )}
              </div>
              <span className={cn(
                "text-xs font-medium uppercase tracking-wide absolute top-12 whitespace-nowrap",
                isCurrent ? "text-primary" : "text-muted-foreground"
              )}>
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
