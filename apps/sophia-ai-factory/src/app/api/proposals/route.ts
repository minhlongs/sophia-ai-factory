import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { generateProposalSchema } from '@/seed/validators/proposal';
import { generateProposal } from '@/seed/ai/proposal-generator';
import { checkProposalQuality } from '@/seed/ai/proposal-quality-check';
import { SYSTEM_TEMPLATES } from '@/seed/ai/proposal-templates';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

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

    return NextResponse.json({
      success: true,
      proposal: generated,
      quality: {
        score: quality.overallScore,
        passed: quality.passed,
        feedback: quality.feedback,
      },
      metadata: generated.metadata,
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
