/**
 * /api/creative-studio/scripts/templates
 *
 * GET — list available script templates
 * POST — generate a script from a template + user inputs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { CAMPAIGN_TEMPLATES } from '@/land/templates/campaign-templates';
import { TIER_RANK } from '@/seed/types';
import { CATEGORY_MIN_TIER, categorySchema } from './modules';
import { handleGenerateScriptPost } from './template-route-handlers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');

    let templates = CAMPAIGN_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      defaults: t.defaults,
    }));

    if (category && category !== 'all') {
      const parsedCategory = categorySchema.safeParse(category);
      if (!parsedCategory.success) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }
      templates = templates.filter((t) => t.category === category);
    }

    const userTier = await resolveUserTier(user.id);
    if (TIER_RANK[userTier] === undefined) {
      return NextResponse.json(
        { error: 'Script templates require a valid tier' },
        { status: 403 },
      );
    }
    const userRank = TIER_RANK[userTier];
    templates = templates.filter((t) => {
      const minTier = CATEGORY_MIN_TIER[t.category];
      if (!minTier) return true;
      return userRank >= TIER_RANK[minTier];
    });

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch script templates' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return handleGenerateScriptPost(req);
}
