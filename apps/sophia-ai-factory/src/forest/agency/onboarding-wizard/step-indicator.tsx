/**
 * Agency Onboarding Wizard Step Indicator.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/step-indicator
 */

import React from 'react';
import {
  Building2,
  Palette,
  Globe,
  Bot,
  Rocket,
  Check,
} from 'lucide-react';
import type { AgencyOnboardingStep } from '@/seed/types';

interface StepIndicatorProps {
  currentStep: AgencyOnboardingStep;
  isVi: boolean;
}

export function StepIndicator({ currentStep, isVi }: StepIndicatorProps) {
  const stepsList = [
    { num: 1, label: isVi ? 'Hồ Sơ' : 'Profile', icon: Building2 },
    { num: 2, label: isVi ? 'Nhận Diện' : 'Branding', icon: Palette },
    { num: 3, label: isVi ? 'Tên Miền' : 'Domain', icon: Globe },
    { num: 4, label: isVi ? 'Trợ Lý AI' : 'Seed Agents', icon: Bot },
    { num: 5, label: isVi ? 'Kích Hoạt' : 'Launch', icon: Rocket },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between">
        {stepsList.map((step, idx) => {
          const Icon = step.icon;
          const isPassed = currentStep > step.num;
          const isCurrent = currentStep === step.num;

          return (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center gap-1.5 flex-1 text-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isPassed
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 font-bold'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isPassed ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:inline ${
                    isCurrent
                      ? 'text-foreground font-semibold'
                      : isPassed
                      ? 'text-foreground/80'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < stepsList.length - 1 && (
                <div
                  className={`h-[2px] w-6 sm:w-12 transition-colors ${
                    currentStep > step.num ? 'bg-emerald-500' : 'bg-muted'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
