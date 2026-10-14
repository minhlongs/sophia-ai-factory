/**
 * Proposal generator prompt builders.
 */

import type { ProposalGenerationParams } from "./proposal-types";

export function buildSystemPrompt(tone: string, length: string): string {
  const toneGuide: Record<string, string> = {
    professional: 'Maintain a professional, business-appropriate tone that instills confidence.',
    friendly: 'Use a warm, approachable tone that builds rapport and trust.',
    technical: 'Include technical details and specifications that demonstrate expertise.',
  };

  const lengthGuide: Record<string, string> = {
    short: 'Keep content concise and focused. Target 1500-2000 words total.',
    medium: 'Provide balanced detail. Target 2500-3000 words total.',
    long: 'Include comprehensive details and examples. Target 3500-4000 words total.',
  };

  return `You are an expert proposal writer for digital agencies specializing in AI automation solutions.

Your task is to generate compelling, client-focused proposals that:
1. Lead with client pain points and desired business outcomes
2. Present solutions in terms of business value, not just technical features
3. Include specific timelines, deliverables, and clear pricing
4. Reference relevant case studies with measurable results
5. End with clear next steps and a strong call-to-action

**Tone:** ${toneGuide[tone] ?? toneGuide.professional}
**Length:** ${lengthGuide[length] ?? lengthGuide.medium}

**Format:** Use markdown with clear section headers (ALWAYS use \`## H2\` for top-level sections — not \`###\` or bare text), bullet points for readability, and bold text for key points.

**Key Principles:**
- Focus on transformation: before (pain) → after (relief/success)
- Use specific numbers and metrics, not vague claims
- Address objections proactively
- Make the next steps frictionless`;
}

export function buildUserPrompt(params: ProposalGenerationParams): string {
  const { clientInfo, solutionInfo, companyInfo } = params;

  return `Generate a proposal with the following context:

## CLIENT INFORMATION
**Client Name:** ${clientInfo.name}
**Company:** ${clientInfo.company}
**Industry:** ${clientInfo.industry}

### Pain Points
${clientInfo.painPoints.map((p) => `- ${p}`).join('\n')}

### Goals
${clientInfo.goals.map((g) => `- ${g}`).join('\n')}

## PROPOSED SOLUTION
**Description:** ${solutionInfo.description}
**Timeline:** ${solutionInfo.timeline}
**Investment:** ${solutionInfo.investment}

### Deliverables
${solutionInfo.deliverables.map((d) => `- ${d}`).join('\n')}

## OUR COMPANY
**Company Name:** ${companyInfo.name}

### Case Studies
${companyInfo.caseStudies
  .map((c) => `**${c.title}**\n- Result: ${c.result}\n- Metric: ${c.metric}`)
  .join('\n\n')}

### Differentiators
${companyInfo.differentiators.map((d) => `- ${d}`).join('\n')}

---

Generate the complete proposal content following the system prompt guidelines.`;
}
