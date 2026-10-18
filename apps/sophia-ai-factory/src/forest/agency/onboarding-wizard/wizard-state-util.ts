/**
 * Agency Onboarding Wizard State Utility Functions.
 *
 * Layer: forest/agency (Presentation & Client Component)
 * @module forest/agency/onboarding-wizard/wizard-state-util
 */

import type {
  AgencyOnboardingResult,
  AgencyOnboardingStep,
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
} from '@/seed/types';
import { DEFAULT_SEED_AGENTS } from './types';
import type { AutonomyLevel, EscalationAction } from '@/seed/types/agent-governance';

export function createInitialAgencyProfile(initialSlug: string): AgencyProfileInput {
  return {
    clientName: '',
    agencySlug: initialSlug || '',
    contactEmail: '',
    industryTag: '',
    initialMcuBudget: 0,
  };
}

export function createInitialAgencyBranding(): AgencyBrandingInput {
  return {
    primaryColor: '#0f172a',
    accentColor: '#10b981',
    logoUrl: '',
  };
}

export function createInitialAgencyDomain(initialSlug: string): AgencyDomainInput {
  return {
    subdomain: initialSlug || '',
    customDomain: '',
  };
}

export function toAgencySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export function createSeedAgentUpdaters(setSeedAgents: React.Dispatch<React.SetStateAction<SeedAgentDeploymentConfig[]>>) {
  return {
    updateSeedAgent: (index: number, updates: Partial<SeedAgentDeploymentConfig>) => {
      setSeedAgents((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
      });
    },
    addSeedAgent: () => {
      setSeedAgents((prev) => [...prev, { ...DEFAULT_SEED_AGENTS[0], id: `agent-${Date.now()}` }]);
    },
    removeSeedAgent: (index: number) => {
      setSeedAgents((prev) => prev.filter((_, i) => i !== index));
    },
    handleToggleAgent: (index: number) => {
      setSeedAgents((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], enabled: !next[index].enabled };
        return next;
      });
    },
    handleUpdateAgentAutonomy: (index: number, autonomy: string) => {
      setSeedAgents((prev) => {
        const next = [...prev];
          next[index] = { ...next[index], maxAutonomy: autonomy as AutonomyLevel };
        return next;
      });
    },
    handleUpdateAgentMcu: (index: number, mcu: number) => {
      setSeedAgents((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], maxComputeUnitsMcu: mcu };
        return next;
      });
    },
    handleUpdateAgentEscalation: (index: number, escalation: string) => {
      setSeedAgents((prev) => {
        const next = [...prev];
          next[index] = { ...next[index], escalationPolicy: escalation as EscalationAction };
        return next;
      });
    },
  };
}
