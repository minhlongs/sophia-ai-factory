/**
 * Proposal generator — shared library for HTTP route + mission handler.
 *
 * Uses OpenRouter (canonical AI gateway). BYOK via `apiKey` param, else falls
 * back to `OPENROUTER_API_KEY` env var.
 */

export interface ProposalGenerationParams {
  clientInfo: {
    name: string;
    company: string;
    industry: string;
    painPoints: string[];
    goals: string[];
  };
  solutionInfo: {
    description: string;
    timeline: string;
    investment: string;
    deliverables: string[];
  };
  companyInfo: {
    name: string;
    caseStudies: Array<{
      title: string;
      result: string;
      metric: string;
    }>;
    differentiators: string[];
  };
  templateId: string;
  tone: 'professional' | 'friendly' | 'technical';
  length: 'short' | 'medium' | 'long';
  apiKey?: string;
}

export interface GeneratedProposal {
  executiveSummary: string;
  problemStatement: string;
  proposedSolution: string;
  timeline: string;
  investment: string;
  caseStudies: string;
  nextSteps: string;
  metadata: {
    tokenCount: number;
    generationTimeMs: number;
    model: string;
  };
}

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export async function generateProposal(
  params: ProposalGenerationParams,
): Promise<GeneratedProposal> {
  const apiKey = params.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenRouter API key not configured. Set OPENROUTER_API_KEY in Settings > Integrations.',
    );
  }

  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt(params.tone, params.length);
  const userPrompt = buildUserPrompt(params);

  const resp = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sophia.agencyos.network',
      'X-Title': 'Sophia AI Factory',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenRouter error: ${resp.status} ${errText.slice(0, 200)}`);
  }

  const json = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
    model?: string;
  };

  const content = json.choices?.[0]?.message?.content ?? '';
  const parsed = parseProposalContent(content);
  const endTime = Date.now();

  return {
    ...parsed,
    metadata: {
      tokenCount: (json.usage?.prompt_tokens ?? 0) + (json.usage?.completion_tokens ?? 0),
      generationTimeMs: endTime - startTime,
      model: json.model ?? DEFAULT_MODEL,
    },
  };
}

function buildSystemPrompt(tone: string, length: string): string {
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

function buildUserPrompt(params: ProposalGenerationParams): string {
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

function parseProposalContent(content: string): Omit<GeneratedProposal, 'metadata'> {
  const sections = content.split(/\n##\s+/);

  const findSection = (keywords: string[]): string => {
    for (const section of sections) {
      const title = section.split('\n')[0]?.toLowerCase() || '';
      if (keywords.some((k) => title.includes(k))) {
        return section.trim();
      }
    }
    return '';
  };

  return {
    executiveSummary: findSection(['executive', 'summary', 'overview']) || sections[1]?.trim() || '',
    problemStatement: findSection(['problem', 'challenge', 'pain', 'current']) || '',
    proposedSolution: findSection(['solution', 'approach', 'methodology']) || '',
    timeline: findSection(['timeline', 'schedule', 'roadmap']) || '',
    investment: findSection(['investment', 'pricing', 'cost', 'fee']) || '',
    caseStudies: findSection(['case study', 'success story', 'previous work']) || '',
    nextSteps: findSection(['next step', 'call to action', 'get started', 'conclusion']) || '',
  };
}
