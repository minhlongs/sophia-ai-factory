/**
 * Agency Onboarding Wizard — Default State Factories & Agent Updaters.
 *
 * Layer: forest/agency (Presentation & Client Component)
 * @module forest/agency/onboarding-wizard/wizard-state-helpers
 */

import type {
  AgencyProfileInput,
  AgencyBrandingInput,
  AgencyDomainInput,
  SeedAgentDeploymentConfig,
  AgyAutonomyLevel,
  EscalationAction,
} from '@/seed/types';

export function createInitialAgencyProfile(initialSlug = ''): AgencyProfileInput {
  return {
    clientName: '',
    agencySlug: initialSlug,
    contactEmail: '',
    industryTag: 'ecommerce',
    initialMcuBudget: 500,
  };
}

export function createInitialAgencyBranding(): AgencyBrandingInput {
  return {
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '#0f172a',
    accentColor: '#10b981',
    customCss: '',
  };
}

export function createInitialAgencyDomain(initialSlug = ''): AgencyDomainInput {
  return {
    subdomain: initialSlug || '',
    customDomain: '',
    cnameTarget: 'agencyos.network',
    isSslReady: true,
  };
}

export function toAgencySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 32);
}

export function createSeedAgentUpdaters(
  setSeedAgents: React.Dispatch<React.SetStateAction<SeedAgentDeploymentConfig[]>>,
) {
  return {
    handleToggleAgent: (idx: number) => {
      setSeedAgents((prev) =>
        prev.map((a, i) => (i === idx ? { ...a, enabled: !a.enabled } : a)),
      );
    },
    handleUpdateAgentAutonomy: (idx: number, level: AgyAutonomyLevel) => {
      setSeedAgents((prev) =>
        prev.map((a, i) => (i === idx ? { ...a, maxAutonomy: level } : a)),
      );
    },
    handleUpdateAgentMcu: (idx: number, mcu: number) => {
      setSeedAgents((prev) =>
        prev.map((a, i) =>
          i === idx ? { ...a, maxComputeUnitsMcu: Math.max(0, mcu) } : a,
        ),
      );
    },
    handleUpdateAgentEscalation: (idx: number, policy: EscalationAction) => {
      setSeedAgents((prev) =>
        prev.map((a, i) => (i === idx ? { ...a, escalationPolicy: policy } : a)),
      );
    },
  };
}
