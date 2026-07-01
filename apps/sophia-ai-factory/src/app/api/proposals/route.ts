import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { generateProposalSchema } from '@/seed/validators/proposal';
import { generateProposal } from '@/seed/ai/proposal-generator';
import { checkProposalQuality } from '@/seed/ai/proposal-quality-check';
import { SYSTEM_TEMPLATES } from '@/seed/ai/proposal-templates';
import { getBalance, deductCredits } from '@/tree/mcu/credits-repo';
import { getProposalCost } from '@/land/billing/proposal-mcu-cost-config';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { verifyCsrfToken } from '@/seed/security/csrf';

export const dynamic = 'force-dynamic';

const COMPANY_PROFILE = {
  name: 'Sophia AI Factory',
  caseStudies: [
    {
      title: 'E-commerce Brand 3x ROAS',
      result: 'Tripled return on ad spend in 90 days',
      metric: '300% ROAS increase',
    },
    {
      title: 'SaaS Company 40% Lead Growth',
      result: 'Increased MQLs by 40% in one quarter',
      metric: '40% more qualified leads',
    },
  ],
  differentiators: [
    'AI-powered proposal generation in <30 seconds',
    'Industry-specific templates and best practices',
    'Professional PDF export ready for client presentation',
    'Built-in quality scoring ensures 80%+ content quality',
  ],
};

export async function POST(request: NextRequest) {
  if (!verifyCsrfToken(request)) {
    return NextResponse.json({ error: 'CSRF token missing or invalid' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const validated = generateProposalSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.issues[0]?.message || 'Invalid input' },
        { status: 400 },
      );
    }

    const cost = getProposalCost('GENERATE');
    const balance = await getBalance(user.id);
    if (balance.credits_remaining < cost) {
      return NextResponse.json(
        {
          error: 'Insufficient MCU credits',
          code: 'INSUFFICIENT_BALANCE',
          required: cost,
          available: balance.credits_remaining,
          upgrade_url: 'https://sophia.agencyos.network/dashboard/credits',
        },
        { status: 402 },
      );
    }

    const data = validated.data;
    const templateId = data.templateId ?? SYSTEM_TEMPLATES[0]!.id;

    const generated = await generateProposal({
      clientInfo: {
        name: data.clientName,
        company: data.clientCompany,
        industry: data.industry,
        painPoints: data.painPoints,
        goals: data.goals,
      },
      solutionInfo: {
        description: data.solutionDescription,
        timeline: data.timeline,
        investment: data.investment,
        deliverables: data.deliverables,
      },
      companyInfo: COMPANY_PROFILE,
      templateId,
      tone: data.tone,
      length: data.length,
    });

    const quality = checkProposalQuality(generated);
    const proposalRef = crypto.randomUUID();
    const deducted = await deductCredits(user.id, cost, proposalRef, 'proposal_generation');
    if (!deducted) {
      logger.warn('[proposals] post-generation deduct failed — balance changed mid-flight', {
        userId: user.id,
        cost,
        proposalRef,
      });
    }

    return NextResponse.json({
      success: true,
      proposal: generated,
      quality: {
        score: quality.overallScore,
        passed: quality.passed,
        feedback: quality.feedback,
      },
      metadata: generated.metadata,
      mcuUsed: cost,
      remainingBalance: Math.max(0, balance.credits_remaining - cost),
    });
  } catch (error) {
    logger.error('proposal generation failed', toError(error));
    return NextResponse.json(
      {
        error: 'Failed to generate proposal',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
