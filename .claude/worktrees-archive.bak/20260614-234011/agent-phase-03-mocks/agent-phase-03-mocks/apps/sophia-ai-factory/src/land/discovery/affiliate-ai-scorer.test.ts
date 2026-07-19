import { describe, it, expect } from "vitest";
import type { AffiliateProgram } from "@/seed/types";
import { scoreAffiliates, getRecommendedAffiliates } from "./affiliate-ai-scorer";
import { DEFAULT_WEIGHTS } from "./affiliate-scoring-primitives";

describe("scoreAffiliates()", () => {
  const mockPrograms: AffiliateProgram[] = [
    {
      id: "p1",
      name: "Sophia AI Copywriting",
      category: "software",
      description: "AI video and copy generation automation platform.",
      commission: "40%",
      commissionType: "recurring",
      cookieDuration: 90,
      epc: 25,
      tags: ["ai", "video", "copywriting"]
    } as AffiliateProgram,
    {
      id: "p2",
      name: "Organic Honey Shop",
      category: "food",
      description: "Direct to consumer sweet natural honey.",
      commission: "10%",
      commissionType: "one-time",
      cookieDuration: 14,
      epc: 1.5,
      tags: ["organic", "honey", "food"]
    } as AffiliateProgram,
    {
      id: "p3",
      name: "Crypto Trading Masterclass",
      category: "finance",
      description: "Learn financial freedom through cryptocurrency trading.",
      commission: "25-45%",
      commissionType: "hybrid",
      cookieDuration: 60,
      epc: 12,
      tags: ["crypto", "finance", "trading"]
    } as AffiliateProgram
  ];

  it("calculates deterministic scores and sorts by relevance descending", () => {
    const scores = scoreAffiliates(mockPrograms, "AI video copywriting");
    
    expect(scores.length).toBe(3);
    // Sophia AI Copywriting (p1) must be first due to high relevance words & strong EPC
    expect(scores[0].programId).toBe("p1");
    expect(scores[0].relevanceScore).toBeGreaterThan(scores[1].relevanceScore);
    expect(scores[1].relevanceScore).toBeGreaterThan(scores[2].relevanceScore);
  });

  it("scores commission percentage, ranges, and flat rates accurately", () => {
    const scores = scoreAffiliates(mockPrograms, "finance");
    
    // p3 has a range commission "25-45%" (midpoint = 35%) and hybrid type (+15% multiplier = ~40.25)
    const p3Score = scores.find(s => s.programId === "p3");
    expect(p3Score).toBeDefined();
    expect(p3Score!.components.commissionScore).toBeCloseTo(40.25, 1);
  });

  it("applies custom scoring weights when provided", () => {
    const customWeights = {
      commission: 0.1,
      cookie: 0.1,
      epc: 0.1,
      nicheMatch: 0.7 // High weight on niche match
    };

    const scores = scoreAffiliates(mockPrograms, "sweet organic honey", customWeights);
    
    // With high niche weight, Organic Honey Shop (p2) should rise in rankings compared to its default score
    expect(scores[0].programId).toBe("p2");
    expect(scores[0].components.nicheMatchScore).toBe(100);
  });

  it("generates correct recommended recommendations status based on threshold", () => {
    const scores = scoreAffiliates(mockPrograms, "organic sweet food");
    const p2Score = scores.find(s => s.programId === "p2");
    
    expect(p2Score).toBeDefined();
    // Organic honey should score high on niche match, but overall low metrics might keep it below threshold (65)
    expect(p2Score!.recommended).toBe(p2Score!.relevanceScore >= 65);
  });
});

describe("getRecommendedAffiliates()", () => {
  const mockPrograms: AffiliateProgram[] = [
    {
      id: "high-perf",
      name: "High Performance Host",
      category: "hosting",
      description: "Premium web hosting with excellent metrics.",
      commission: "50%",
      commissionType: "recurring",
      cookieDuration: 90,
      epc: 30,
      tags: ["hosting", "web"]
    } as AffiliateProgram,
    {
      id: "low-perf",
      name: "Low Pay Bookshop",
      category: "books",
      description: "Sell books with small commission rates.",
      commission: "2%",
      commissionType: "one-time",
      cookieDuration: 1,
      epc: 0.1,
      tags: ["books", "read"]
    } as AffiliateProgram
  ];

  it("filters out programs below default recommendation threshold", () => {
    const recommended = getRecommendedAffiliates(mockPrograms, "web hosting");
    
    expect(recommended.length).toBe(1);
    expect(recommended[0].programId).toBe("high-perf");
  });

  it("respects custom thresholds when specified", () => {
    // Specify a very low threshold to include both
    const recommended = getRecommendedAffiliates(mockPrograms, "hosting books", 10);
    expect(recommended.length).toBe(2);
  });
});
