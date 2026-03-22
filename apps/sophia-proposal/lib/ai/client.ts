import Anthropic from "@anthropic-ai/sdk";

// Lazy client — avoids throwing at module import during Next.js build
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Missing ANTHROPIC_API_KEY environment variable");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// Proxy preserves `claudeClient.messages.create(...)` usage across codebase
export const claudeClient = new Proxy({} as Anthropic, {
  get(_, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

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
  tone: "professional" | "friendly" | "technical";
  length: "short" | "medium" | "long";
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

/**
 * Generate proposal content using Claude API
 */
export async function generateProposal(
  params: ProposalGenerationParams
): Promise<GeneratedProposal> {
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt(params.tone, params.length);
  const userPrompt = buildUserPrompt(params);

  const response = await claudeClient.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const endTime = Date.now();
  const content = response.content[0];

  if (content.type !== "text") {
    throw new Error("Unexpected response format from Claude API");
  }

  const generatedContent = parseProposalContent(content.text);

  return {
    ...generatedContent,
    metadata: {
      tokenCount: response.usage.input_tokens + response.usage.output_tokens,
      generationTimeMs: endTime - startTime,
      model: response.model,
    },
  };
}

function buildSystemPrompt(
  tone: string,
  length: string
): string {
  const toneGuide = {
    professional: "Maintain a professional, business-appropriate tone that instills confidence.",
    friendly: "Use a warm, approachable tone that builds rapport and trust.",
    technical: "Include technical details and specifications that demonstrate expertise.",
  };

  const lengthGuide = {
    short: "Keep content concise and focused. Target 1500-2000 words total.",
    medium: "Provide balanced detail. Target 2500-3000 words total.",
    long: "Include comprehensive details and examples. Target 3500-4000 words total.",
  };

  return `You are an expert proposal writer for digital agencies specializing in AI automation solutions.

Your task is to generate compelling, client-focused proposals that:
1. Lead with client pain points and desired business outcomes
2. Present solutions in terms of business value, not just technical features
3. Include specific timelines, deliverables, and clear pricing
4. Reference relevant case studies with measurable results
5. End with clear next steps and a strong call-to-action

**Tone:** ${toneGuide[tone as keyof typeof toneGuide]}
**Length:** ${lengthGuide[length as keyof typeof lengthGuide]}

**Format:** Use markdown with clear section headers, bullet points for readability, and bold text for key points.

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
${clientInfo.painPoints.map((p) => `- ${p}`).join("\n")}

### Goals
${clientInfo.goals.map((g) => `- ${g}`).join("\n")}

## PROPOSED SOLUTION
**Description:** ${solutionInfo.description}
**Timeline:** ${solutionInfo.timeline}
**Investment:** ${solutionInfo.investment}

### Deliverables
${solutionInfo.deliverables.map((d) => `- ${d}`).join("\n")}

## OUR COMPANY
**Company Name:** ${companyInfo.name}

### Case Studies
${companyInfo.caseStudies
  .map((c) => `**${c.title}**\n- Result: ${c.result}\n- Metric: ${c.metric}`)
  .join("\n\n")}

### Differentiators
${companyInfo.differentiators.map((d) => `- ${d}`).join("\n")}

---

Generate the complete proposal content following the system prompt guidelines.`;
}

function parseProposalContent(content: string): Omit<GeneratedProposal, "metadata"> {
  // Simple section parsing - can be enhanced with more sophisticated extraction
  const sections = content.split(/\n##\s+/);

  const findSection = (keywords: string[]): string => {
    for (const section of sections) {
      const title = section.split("\n")[0]?.toLowerCase() || "";
      if (keywords.some((k) => title.includes(k))) {
        return section.trim();
      }
    }
    return "";
  };

  return {
    executiveSummary: findSection(["executive", "summary", "overview"]) || sections[1]?.trim() || "",
    problemStatement: findSection(["problem", "challenge", "pain", "current"]) || "",
    proposedSolution: findSection(["solution", "approach", "methodology"]) || "",
    timeline: findSection(["timeline", "schedule", "roadmap"]) || "",
    investment: findSection(["investment", "pricing", "cost", "fee"]) || "",
    caseStudies: findSection(["case study", "success story", "previous work"]) || "",
    nextSteps: findSection(["next step", "call to action", "get started", "conclusion"]) || "",
  };
}
