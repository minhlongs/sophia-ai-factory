/**
 * Default Team Roles for Multi-Agent Orchestrator
 */

/** Parsed agent definition from agents.yaml (Tier 1 HDR format) */
export interface DefaultAgentRole {
  role: string;
  goal: string;
  tools: string[];
  backstory?: string;
}

/** Default team agent definitions for orchestrator spawn */
export const DEFAULT_TEAM_ROLES: Record<string, DefaultAgentRole> = {
  cto: {
    role: 'Chief Technology Officer',
    goal: 'Own everything technical: code quality, security, infrastructure, CI/CD, incident response, and QA validation.',
    tools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob'],
    backstory: 'CTO agent — Sophia AI Factory technical leadership.',
  },
  cmo: {
    role: 'Chief Marketing Officer',
    goal: 'Drive go-to-market strategy, brand positioning, demand generation, and customer acquisition.',
    tools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob', 'mekong'],
    backstory: 'CMO agent — Sophia AI Factory marketing leadership.',
  },
  cso: {
    role: 'Chief Strategy Officer',
    goal: 'Define business strategy, competitive positioning, and long-term roadmap alignment.',
    tools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob', 'mekong'],
    backstory: 'CSO agent — Sophia AI Factory strategy leadership.',
  },
  coo: {
    role: 'Chief Operating Officer',
    goal: 'Oversee day-to-day operations, resource allocation, and cross-functional execution.',
    tools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob', 'mekong'],
    backstory: 'COO agent — Sophia AI Factory operations leadership.',
  },
};
