import { describe, it, expect } from "vitest";
import { generateProposalSchema } from "@/lib/validators/proposal";

describe("Proposal Validators", () => {
  describe("generateProposalSchema", () => {
    it("should validate valid proposal input", () => {
      const validInput = {
        templateId: "123e4567-e89b-12d3-a456-426614174000",
        clientName: "John Smith",
        clientCompany: "Acme Corp",
        industry: "E-commerce",
        painPoints: ["Low conversion rate", "High cart abandonment"],
        goals: ["Increase sales by 50%", "Reduce cart abandonment"],
        solutionDescription: "Comprehensive CRO optimization",
        timeline: "8 weeks",
        investment: "$10,000 - $15,000",
        deliverables: ["Landing page redesign", "A/B testing", "Analytics dashboard"],
        tone: "professional" as const,
        length: "medium" as const,
      };

      const result = generateProposalSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid templateId", () => {
      const invalidInput = {
        templateId: "invalid-uuid",
        clientName: "John Smith",
        clientCompany: "Acme Corp",
        industry: "E-commerce",
        painPoints: ["Low conversion"],
        goals: ["Increase sales"],
        solutionDescription: "CRO optimization",
        timeline: "8 weeks",
        investment: "$10,000",
        deliverables: ["Redesign"],
        tone: "professional" as const,
        length: "medium" as const,
      };

      const result = generateProposalSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.path).toContain("templateId");
    });

    it("should reject empty painPoints", () => {
      const invalidInput = {
        templateId: "123e4567-e89b-12d3-a456-426614174000",
        clientName: "John Smith",
        clientCompany: "Acme Corp",
        industry: "E-commerce",
        painPoints: [],
        goals: ["Increase sales"],
        solutionDescription: "CRO optimization",
        timeline: "8 weeks",
        investment: "$10,000",
        deliverables: ["Redesign"],
        tone: "professional" as const,
        length: "medium" as const,
      };

      const result = generateProposalSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).toContain("pain point");
    });

    it("should reject short clientName", () => {
      const invalidInput = {
        templateId: "123e4567-e89b-12d3-a456-426614174000",
        clientName: "J",
        clientCompany: "Acme Corp",
        industry: "E-commerce",
        painPoints: ["Low conversion"],
        goals: ["Increase sales"],
        solutionDescription: "CRO optimization",
        timeline: "8 weeks",
        investment: "$10,000",
        deliverables: ["Redesign"],
        tone: "professional" as const,
        length: "medium" as const,
      };

      const result = generateProposalSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).toContain("2 characters");
    });
  });
});
