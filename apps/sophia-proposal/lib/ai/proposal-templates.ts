import { z } from "zod";

export const proposalTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  industry: z.string().optional(),
  systemPrompt: z.string(),
  userPromptTemplate: z.string(),
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      description: z.string(),
      required: z.boolean().default(true),
    })
  ),
  isSystem: z.boolean().default(false),
  createdAt: z.date().optional(),
});

export type ProposalTemplate = z.infer<typeof proposalTemplateSchema>;

// System templates
export const SYSTEM_TEMPLATES: ProposalTemplate[] = [
  {
    id: "template-agency-standard",
    name: "Digital Agency - Standard",
    description: "Standard proposal for digital marketing agencies",
    industry: "Digital Marketing",
    systemPrompt: `You are an expert proposal writer for digital marketing agencies.
Create compelling proposals that emphasize:
1. Marketing ROI and measurable outcomes
2. Multi-channel strategy (social, SEO, paid ads)
3. Content marketing and brand building
4. Clear KPIs and reporting cadence

Tone: Professional yet energetic
Focus: Growth, visibility, customer acquisition`,
    userPromptTemplate: `Client: {clientName} at {clientCompany}
Industry: {industry}
Challenge: {painPoints}
Goal: {goals}

Generate a marketing-focused proposal.`,
    sections: [
      { key: "executiveSummary", title: "Executive Summary", description: "Overview of the proposal", required: true },
      { key: "problemStatement", title: "Current Challenges", description: "Client pain points", required: true },
      { key: "proposedSolution", title: "Our Solution", description: "Marketing strategy", required: true },
      { key: "timeline", title: "Timeline & Milestones", description: "Project schedule", required: true },
      { key: "investment", title: "Investment", description: "Pricing breakdown", required: true },
      { key: "caseStudies", title: "Success Stories", description: "Relevant case studies", required: false },
      { key: "nextSteps", title: "Next Steps", description: "Call to action", required: true },
    ],
    isSystem: true,
  },
  {
    id: "template-saas-technical",
    name: "SaaS - Technical Integration",
    description: "Technical proposal for SaaS integrations and API development",
    industry: "SaaS/Technology",
    systemPrompt: `You are an expert technical proposal writer for SaaS companies.
Create proposals that emphasize:
1. Technical architecture and integration approach
2. API design, security, and scalability
3. Development methodology (Agile/Scrum)
4. Technical debt reduction and best practices

Tone: Technical but accessible
Focus: Reliability, scalability, maintainability`,
    userPromptTemplate: `Client: {clientName} at {clientCompany}
Stack: {industry}
Technical Challenge: {painPoints}
Objectives: {goals}

Generate a technical integration proposal.`,
    sections: [
      { key: "executiveSummary", title: "Executive Summary", description: "Project overview", required: true },
      { key: "technicalApproach", title: "Technical Approach", description: "Architecture and methodology", required: true },
      { key: "integrationPlan", title: "Integration Plan", description: "API and system integration", required: true },
      { key: "timeline", title: "Development Timeline", description: "Sprint breakdown", required: true },
      { key: "investment", title: "Investment", description: "Cost breakdown", required: true },
      { key: "caseStudies", title: "Technical Case Studies", description: "Similar implementations", required: false },
      { key: "nextSteps", title: "Getting Started", description: "Onboarding process", required: true },
    ],
    isSystem: true,
  },
  {
    id: "template-ecommerce-growth",
    name: "E-commerce - Growth & Conversion",
    description: "Proposal for e-commerce optimization and growth",
    industry: "E-commerce",
    systemPrompt: `You are an expert proposal writer for e-commerce businesses.
Create proposals that emphasize:
1. Conversion rate optimization (CRO)
2. Customer lifetime value (CLV)
3. Cart abandonment reduction
4. Mobile commerce and UX

Tone: Results-driven and data-focused
Focus: Revenue growth, AOV, retention`,
    userPromptTemplate: `Client: {clientName} at {clientCompany}
Platform: {industry}
Pain Points: {painPoints}
Growth Goals: {goals}

Generate an e-commerce growth proposal.`,
    sections: [
      { key: "executiveSummary", title: "Executive Summary", description: "Growth opportunity overview", required: true },
      { key: "auditFindings", title: "Current State Audit", description: "UX and conversion analysis", required: true },
      { key: "proposedSolution", title: "Optimization Strategy", description: "CRO and growth tactics", required: true },
      { key: "timeline", title: "Implementation Timeline", description: "Phase rollout", required: true },
      { key: "investment", title: "Investment & ROI", description: "Cost and projected returns", required: true },
      { key: "caseStudies", title: "E-commerce Success Stories", description: "Similar brand results", required: false },
      { key: "nextSteps", title: "Launch Plan", description: "Kickoff and milestones", required: true },
    ],
    isSystem: true,
  },
];

export function getSystemTemplate(templateId: string): ProposalTemplate | undefined {
  return SYSTEM_TEMPLATES.find((t) => t.id === templateId);
}

export function getAllSystemTemplates(): ProposalTemplate[] {
  return SYSTEM_TEMPLATES;
}

export function buildPromptFromTemplate(
  template: ProposalTemplate,
  variables: Record<string, string | string[]>
): { system: string; user: string } {
  let userPrompt = template.userPromptTemplate;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    const replacement = Array.isArray(value) ? value.join(", ") : value;
    userPrompt = userPrompt.replace(new RegExp(placeholder, "g"), replacement);
  }

  return {
    system: template.systemPrompt,
    user: userPrompt,
  };
}
