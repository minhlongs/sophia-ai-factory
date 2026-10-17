'use client';

/**
 * Step body and error banner for Agency Client Onboarding Wizard.
 * @module forest/agency/agency-onboarding-wizard-step-body
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import type {
  AgencyOnboardingStep,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
  AgyAutonomyLevel,
  EscalationAction,
} from '@/seed/types';
import {
  StepProfile,
  StepBranding,
  StepDomain,
  StepSeedAgents,
  StepReviewLaunch,
  WizardControls,
} from './onboarding-wizard';

export interface WizardErrorBannerProps {
  generalError: string | null;
  stepErrors: string[];
}

export function WizardErrorBanner({ generalError, stepErrors }: WizardErrorBannerProps) {
  if (!generalError && stepErrors.length === 0) return null;

  return (
    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm flex items-start gap-3">
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="space-y-1">
        {generalError && <p className="font-semibold">{generalError}</p>}
        {stepErrors.map((err, i) => (
          <p key={i} className="text-xs">• {err}</p>
        ))}
      </div>
    </div>
  );
}

export interface WizardStepBodyProps {
  currentStep: AgencyOnboardingStep;
  isSubmitting: boolean;
  isValidating: boolean;
  isVi: boolean;
  profile: AgencyProfileInput;
  setProfile: React.Dispatch<React.SetStateAction<AgencyProfileInput>>;
  branding: AgencyBrandingInput;
  setBranding: React.Dispatch<React.SetStateAction<AgencyBrandingInput>>;
  domain: AgencyDomainInput;
  setDomain: React.Dispatch<React.SetStateAction<AgencyDomainInput>>;
  seedAgents: SeedAgentDeploymentConfig[];
  handleClientNameChange: (name: string) => void;
  handleToggleAgent: (idx: number) => void;
  handleUpdateAgentAutonomy: (idx: number, level: AgyAutonomyLevel) => void;
  handleUpdateAgentMcu: (idx: number, mcu: number) => void;
  handleUpdateAgentEscalation: (idx: number, policy: EscalationAction) => void;
  handlePrevStep: () => void;
  handleNextStep: () => void;
  handleLaunch: () => void;
}

export function WizardStepBody(props: WizardStepBodyProps) {
  const { currentStep, isSubmitting, isValidating, isVi } = props;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-md">
      {currentStep === 1 && (
        <StepProfile
          profile={props.profile}
          setProfile={props.setProfile}
          onClientNameChange={props.handleClientNameChange}
          isVi={isVi}
        />
      )}
      {currentStep === 2 && (
        <StepBranding
          branding={props.branding}
          setBranding={props.setBranding}
          profile={props.profile}
          isVi={isVi}
        />
      )}
      {currentStep === 3 && (
        <StepDomain domain={props.domain} setDomain={props.setDomain} isVi={isVi} />
      )}
      {currentStep === 4 && (
        <StepSeedAgents
          seedAgents={props.seedAgents}
          handleToggleAgent={props.handleToggleAgent}
          handleUpdateAgentAutonomy={props.handleUpdateAgentAutonomy}
          handleUpdateAgentMcu={props.handleUpdateAgentMcu}
          handleUpdateAgentEscalation={props.handleUpdateAgentEscalation}
          isVi={isVi}
        />
      )}
      {currentStep === 5 && (
        <StepReviewLaunch
          profile={props.profile}
          branding={props.branding}
          domain={props.domain}
          seedAgents={props.seedAgents}
          isVi={isVi}
        />
      )}
      <WizardControls
        currentStep={currentStep}
        isSubmitting={isSubmitting}
        isValidating={isValidating}
        handlePrevStep={props.handlePrevStep}
        handleNextStep={props.handleNextStep}
        handleLaunch={props.handleLaunch}
        isVi={isVi}
      />
    </div>
  );
}
