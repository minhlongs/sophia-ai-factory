/**
 * Agency Onboarding Wizard Navigation Controls.
 *
 * Layer: forest/agency (Presentation & Client Component)
 *
 * @module forest/agency/onboarding-wizard/wizard-controls
 */

import React from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Rocket } from 'lucide-react';
import type { AgencyOnboardingStep } from '@/seed/types';

interface WizardControlsProps {
  currentStep: AgencyOnboardingStep;
  isSubmitting: boolean;
  isValidating: boolean;
  handlePrevStep: () => void;
  handleNextStep: () => void;
  handleLaunch: () => void;
  isVi: boolean;
}

export function WizardControls({
  currentStep,
  isSubmitting,
  isValidating,
  handlePrevStep,
  handleNextStep,
  handleLaunch,
  isVi,
}: WizardControlsProps) {
  return (
    <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
      <div>
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handlePrevStep}
            disabled={isSubmitting || isValidating}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            {isVi ? 'Quay Lại' : 'Previous Step'}
          </button>
        )}
      </div>

      <div>
        {currentStep < 5 ? (
          <button
            type="button"
            onClick={handleNextStep}
            disabled={isValidating}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {isValidating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isVi ? 'Tiếp Tục' : 'Continue'}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLaunch}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors inline-flex items-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-600/20"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                {isVi ? 'Đang Khởi Tạo Không Gian...' : 'Provisioning Workspace...'}
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                {isVi ? 'Kích Hoạt Cổng Khách Hàng Ngay' : 'Launch Client Portal Now'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
