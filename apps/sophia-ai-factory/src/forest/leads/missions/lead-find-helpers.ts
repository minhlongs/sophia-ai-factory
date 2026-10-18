/**
 * Stub lead generator and Apollo normalisation helpers for lead:find mission.
 * @module forest/leads/missions/lead-find-helpers
 */

import type { ApolloPerson } from '@/tree/apollo/apollo-client';

export const STUB_DELAY_MS = 1000;

const SAMPLE_COMPANIES = [
  'TechFlow Solutions', 'BrightMind Agency', 'NextGen Digital', 'Peak Performance Co',
  'CloudBase Systems', 'Luminary Labs', 'SwiftScale Inc', 'Horizon Marketing',
  'Catalyst Creative', 'Velocity Ventures', 'Apex Digital', 'Prism Analytics',
  'Nexus Media', 'Blueprint Agency', 'Momentum Growth', 'Elevate Digital',
  'Spark Solutions', 'Clarity Consulting', 'Pinnacle Media', 'Fusion Creative',
];
const SAMPLE_TITLES = [
  'CEO', 'Founder', 'CMO', 'Head of Marketing', 'VP Sales', 'Director of Growth',
  'Marketing Manager', 'Head of Business Development', 'Co-Founder', 'Growth Lead',
];
const SAMPLE_DOMAINS = [
  'techflow.io', 'brightmind.co', 'nextgendigital.com', 'peakperformance.io',
  'cloudbase.dev', 'luminarylabs.com', 'swiftscale.io', 'horizonmarketing.co',
  'catalystcreative.agency', 'velocityventures.io', 'apexdigital.co', 'prismanalytics.io',
  'nexusmedia.com', 'blueprintagency.co', 'momentumgrowth.io', 'elevatedigital.com',
  'sparksolutions.co', 'clarityconsulting.io', 'pinnaclemedia.co', 'fusioncreative.agency',
];

export interface NormalisedLead {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  company: string | null;
  domain: string | null;
  linkedin_url: string | null;
  industry: string | null;
  source: 'apollo' | 'stub';
}

export function normaliseApolloPerson(p: ApolloPerson): NormalisedLead {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    title: p.title,
    company: p.organization?.name ?? null,
    domain: p.organization?.primary_domain ?? null,
    linkedin_url: p.linkedin_url,
    industry: p.organization?.industry ?? null,
    source: 'apollo',
  };
}

export function buildStubLeads(niche: string, count: number): NormalisedLead[] {
  return Array.from({ length: count }, (_, i) => {
    const idx = i % SAMPLE_COMPANIES.length;
    const firstName = ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Sam', 'Jamie'][i % 8];
    const lastName = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'][i % 8];
    return {
      id: `lead-stub-${i + 1}`,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${SAMPLE_DOMAINS[idx]}`,
      title: SAMPLE_TITLES[i % SAMPLE_TITLES.length],
      company: SAMPLE_COMPANIES[idx],
      domain: SAMPLE_DOMAINS[idx],
      linkedin_url: null,
      industry: niche,
      source: 'stub' as const,
    };
  });
}
