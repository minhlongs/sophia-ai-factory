import { NextRequest, NextResponse } from "next/server";
import { generateProposalSchema } from "@/lib/validators/proposal";
import { generateProposal, getAnthropicClient } from "@/lib/ai/client";
import { checkProposalQuality } from "@/lib/ai/quality-check";
import { getSystemTemplate } from "@/lib/ai/proposal-templates";
import { logUsage } from "@/lib/billing/usage-tracker";
import { getOrInitializeBalance, requireBalance } from "@/lib/billing/balance-checker";
import { createServerClient } from "@/lib/db/client";
import type { Subscription } from "@/lib/db/types";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

/**
 * POST /api/proposals/generate
 * Generate AI proposal from template and inputs
 */
export async function POST(request: NextRequest) {
  if (!getAnthropicClient() && !process.env.LLM_BASE_URL) {
    return NextResponse.json({ success: false, error: "AI not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();

    // Validate input
    const validatedData = generateProposalSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    // Get organization ID from header (set by middleware or auth)
    const orgId = request.headers.get("x-org-id");
    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      );
    }

    // Check and initialize balance
    const balance = await getOrInitializeBalance(orgId);
    const balanceError = requireBalance(balance);
    if (balanceError) {
      return balanceError; // Returns 402 Payment Required
    }

    const {
      templateId,
      clientName,
      clientCompany,
      industry,
      painPoints,
      goals,
      solutionDescription,
      timeline,
      investment,
      deliverables,
      tone,
      length,
    } = validatedData.data;

    // Get template
    const template = getSystemTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Get user's subscription tier for pricing
    const db = createServerClient();
    const { data: subscription } = await db
      .from<Subscription>("subscriptions")
      .select("tier_name")
      .eq("org_id", orgId)
      .eq("status", "active")
      .single();

    // Generate proposal using Claude API
    const generatedProposal = await generateProposal({
      clientInfo: {
        name: clientName,
        company: clientCompany,
        industry,
        painPoints,
        goals,
      },
      solutionInfo: {
        description: solutionDescription,
        timeline,
        investment,
        deliverables,
      },
      companyInfo: {
        name: "Sophia AI Factory",
        caseStudies: [
          {
            title: "E-commerce Brand 3x ROAS",
            result: "Tripled return on ad spend in 90 days",
            metric: "300% ROAS increase",
          },
          {
            title: "SaaS Company 40% Lead Growth",
            result: "Increased MQLs by 40% in one quarter",
            metric: "40% more qualified leads",
          },
        ],
        differentiators: [
          "AI-powered proposal generation in <30 seconds",
          "Industry-specific templates and best practices",
          "Professional PDF export ready for client presentation",
          "Built-in quality scoring ensures 80%+ content quality",
        ],
      },
      templateId,
      tone,
      length,
    });

    // Log usage and deduct MCU after successful generation
    const usage = await logUsage({
      orgId,
      feature: "proposal:text:advanced",
      metadata: {
        templateId,
        clientCompany,
        qualityScore: checkProposalQuality(generatedProposal).overallScore
      },
      tierName: subscription?.tier_name,
    });

    if (!usage.success) {
      console.warn("Failed to log usage:", usage.error);
    }

    // Quality check
    const qualityResult = checkProposalQuality(generatedProposal);

    return NextResponse.json({
      success: true,
      proposal: generatedProposal,
      quality: {
        score: qualityResult.overallScore,
        passed: qualityResult.passed,
        feedback: qualityResult.feedback,
      },
      metadata: generatedProposal.metadata,
      mcuUsed: usage.mcuCost,
      remainingBalance: usage.remainingBalance,
    });
  } catch (error) {
    console.error("Proposal generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate proposal",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
