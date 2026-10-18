import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getTemplateById } from '@/land/templates/campaign-templates';
import { TIER_RANK } from '@/seed/types';
import {
  CATEGORY_MIN_TIER,
  generateScriptSchema,
  tierMeetsMinimum,
  buildScriptFromTemplate,
} from './modules';

export async function handleGenerateScriptPost(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tier = await resolveUserTier(user.id);
    if (TIER_RANK[tier] === undefined) {
      return NextResponse.json(
        { error: 'Script generation requires a valid tier' },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = generateScriptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid script input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { templateId, topic, brandName, targetDuration, tone, language } = parsed.data;

    const template = getTemplateById(templateId);
    if (!template) {
      return NextResponse.json(
        { error: `Template not found: ${templateId}` },
        { status: 404 },
      );
    }

    const minTier = CATEGORY_MIN_TIER[template.category];
    if (minTier && !tierMeetsMinimum(tier, minTier)) {
      return NextResponse.json(
        {
          error: 'Insufficient tier for this template category',
          requiredTier: minTier,
          currentTier: tier,
        },
        { status: 403 },
      );
    }

    const script = buildScriptFromTemplate({
      template,
      topic,
      brandName: brandName || (language === 'vi' ? 'Chúng tôi' : 'Our Channel'),
      targetDuration,
      tone: tone || template.defaults.tone,
      language,
    });

    return NextResponse.json({ script }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate script' },
      { status: 500 },
    );
  }
}
