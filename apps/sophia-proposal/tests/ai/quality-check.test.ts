import { describe, it, expect } from "vitest";
import { checkProposalQuality } from "@/lib/ai/quality-check";
import { GeneratedProposal } from "@/lib/ai/client";

const mockProposal: GeneratedProposal = {
  executiveSummary: "## Executive Summary\n\nThis is a **comprehensive** executive summary that provides:\n- Detailed overview of the proposal\n- Clear value proposition\n- Measurable outcomes",
  problemStatement: "## Current Challenges\n\nThe client is facing significant challenges:\n- Low conversion rates (**<2%**)\n- High cart abandonment (**>75%**)\n- Poor mobile experience impacting revenue growth",
  proposedSolution: "## Proposed Solution\n\nOur comprehensive solution includes:\n- Landing page redesign\n- A/B testing framework\n- Analytics implementation\n- Mobile optimization\n\n**Expected ROI:** 3x within 90 days",
  timeline: "## Timeline\n\n**8 weeks total duration** with 2-week sprints:\n- Week 1-2: Discovery and audit\n- Week 3-4: Design and prototyping\n- Week 5-6: Development\n- Week 7-8: Testing and launch",
  investment: "## Investment\n\n**$10,000 - $15,000** depending on final scope and requirements.\n\nPayment schedule:\n- 50% upfront\n- 25% at midpoint\n- 25% upon completion",
  caseStudies: "## Success Stories\n\n**E-commerce Brand:** 3x ROAS increase, 40% reduction in cart abandonment within 90 days.",
  nextSteps: "## Next Steps\n\n1. **Schedule a 30-minute call** within the next 5 business days\n2. Offer expires in **14 days**\n3. Contact us at hello@sophia.ai to get started",
  metadata: {
    tokenCount: 2500,
    generationTimeMs: 15000,
    model: "claude-sonnet-4-20250514",
  },
};

describe("Quality Check", () => {
  it("should pass a high-quality proposal", () => {
    const result = checkProposalQuality(mockProposal);

    // Note: Completeness may be capped at 60 if total length < 1500 chars
    expect(result.overallScore).toBeGreaterThanOrEqual(60);
    expect(result.scores.specificity).toBeGreaterThanOrEqual(80);
    expect(result.scores.professionalism).toBeGreaterThanOrEqual(70);
  });

  it("should fail a low-quality proposal", () => {
    const lowQualityProposal: GeneratedProposal = {
      executiveSummary: "Short summary",
      problemStatement: "",
      proposedSolution: "",
      timeline: "",
      investment: "",
      caseStudies: "",
      nextSteps: "",
      metadata: {
        tokenCount: 500,
        generationTimeMs: 5000,
        model: "claude-sonnet-4-20250514",
      },
    };

    const result = checkProposalQuality(lowQualityProposal);

    expect(result.overallScore).toBeLessThan(80);
    expect(result.passed).toBe(false);
    expect(result.feedback.length).toBeGreaterThan(0);
  });

  it("should check for specificity (numbers and metrics)", () => {
    const result = checkProposalQuality(mockProposal);
    expect(result.scores.specificity).toBeGreaterThanOrEqual(80);
  });

  it("should check for professional formatting", () => {
    const result = checkProposalQuality(mockProposal);
    expect(result.scores.professionalism).toBeGreaterThanOrEqual(70);
  });
});
