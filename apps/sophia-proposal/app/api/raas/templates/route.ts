/**
 * GET /api/raas/templates
 *
 * List available mission templates, optionally filtered by category.
 * Public within authenticated org — no MCU deduction.
 *
 * Query params:
 *   category — 'proposal' | 'video' | 'affiliate' | 'content' | 'analytics'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authClient = createAuthClient(
      request.headers.get('authorization')?.split(' ')[1]
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serverClient = createServerClient();
    const category = request.nextUrl.searchParams.get('category');

    let query = serverClient
      .from('mission_templates')
      .select('*')
      .eq('is_active', true)
      .order('mcu_cost', { ascending: true });

    if (category) {
      const valid = ['proposal', 'video', 'affiliate', 'content', 'analytics'];
      if (!valid.includes(category)) {
        return NextResponse.json(
          { error: `Invalid category. Valid: ${valid.join(', ')}` },
          { status: 400 }
        );
      }
      query = query.eq('category', category);
    }

    const { data: templates, error } = await query;
    if (error) throw error;

    return NextResponse.json({ templates: templates ?? [] });
  } catch (err) {
    console.error('GET /api/raas/templates error:', err);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}
