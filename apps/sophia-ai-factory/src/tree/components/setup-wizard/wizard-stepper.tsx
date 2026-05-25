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
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-zinc-800 -z-10 rounded-full" />
        <div
          className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-gradient-to-r from-violet-600 to-cyan-500 -z-10 rounded-full transition-all duration-300 ease-in-out shadow-[0_0_10px_rgba(139,92,246,0.3)]"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div key={index} className="flex flex-col items-center gap-2 bg-zinc-950/80 px-2 rounded-lg relative">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ease-in-out",
                  isCompleted ? "bg-violet-600 border-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.4)]" :
                  isCurrent ? "bg-zinc-900 border-cyan-400 text-cyan-400 ring-4 ring-cyan-400/20 shadow-[0_0_12px_rgba(6,182,212,0.4)]" :
                  "bg-zinc-950 border-zinc-800 text-zinc-600"
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 stroke-[3px]" aria-hidden="true" />
                ) : (
                  <span className="font-semibold text-sm">{stepNum}</span>
                )}
              </div>
              <span className={cn(
                "text-[10px] md:text-xs font-semibold uppercase tracking-wider absolute top-12 whitespace-nowrap transition-colors duration-300",
                isCurrent ? "text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.3)]" :
                isCompleted ? "text-zinc-400" :
                "text-zinc-600"
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
