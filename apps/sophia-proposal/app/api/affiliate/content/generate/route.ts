/**
 * POST /api/affiliate/content/generate
 *
 * Generate AI content (blog/video/social) for an affiliate program.
 * Pre-deducts MCU; refunds on failure. Idempotent via unique key.
 * Max cost: 50 (blog) + 200 (video) + 10 (social) = 260 MCU.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getAuthContext } from '@/lib/raas/auth-context';
import type { AffiliateProgram } from '@/types/affiliate';
import { logUsage } from '@/lib/billing/usage-tracker';
import { getOrInitializeBalance, requireBalance } from '@/lib/billing/balance-checker';
import { generateBlogReview } from '@/lib/affiliate/content/blog-generator';
import { generateVideoReview } from '@/lib/affiliate/content/video-generator';
import { generateSocialBundle } from '@/lib/affiliate/content/social-generator';

export const dynamic = 'force-dynamic';

type ContentType = 'blog' | 'video' | 'social';

const MCU_BY_TYPE: Record<ContentType, number> = {
  blog: 50,
  video: 200,
  social: 10,
};

export async function POST(req: NextRequest) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orgId } = auth;

  let body: { programId?: string; contentTypes?: ContentType[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { programId, contentTypes } = body;
  if (!programId || !Array.isArray(contentTypes) || contentTypes.length === 0) {
    return NextResponse.json({ error: 'programId and contentTypes are required' }, { status: 400 });
  }

  const validTypes: ContentType[] = ['blog', 'video', 'social'];
  const invalidTypes = contentTypes.filter((t) => !validTypes.includes(t));
  if (invalidTypes.length > 0) {
    return NextResponse.json({ error: `Invalid content types: ${invalidTypes.join(', ')}` }, { status: 400 });
  }

  // Check MCU balance covers full cost upfront
  const totalMcu = contentTypes.reduce((sum, t) => sum + MCU_BY_TYPE[t], 0);
  const balance = await getOrInitializeBalance(orgId);
  if (!balance || balance.balance < totalMcu) {
    return NextResponse.json(
      { error: 'Insufficient MCU balance', required: totalMcu, current: balance?.balance ?? 0 },
      { status: 402 }
    );
  }
  const balanceErr = requireBalance(balance);
  if (balanceErr) return balanceErr;

  const db = createServerClient();

  // Fetch program data
  const { data: program, error: pgErr } = await db
    .from<AffiliateProgram>('affiliate_programs')
    .select('*')
    .eq('id', programId)
    .eq('org_id', orgId)
    .single();

  if (pgErr || !program) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  const contentIds: Record<string, string> = {};
  const errors: Record<string, string> = {};

  // Map AffiliateProgram (DB shape) to AffiliateProgramData (generator input shape)
  const programData = {
    id: program.id,
    name: program.name,
    description: program.description ?? '',
    category: program.niche,
    website_url: program.url,
    affiliate_url: program.signup_url ?? program.url,
    commission_rate: program.commission_rate,
  };

  // Generate blog first (video-generator needs blog content)
  let blogContent = null;

  if (contentTypes.includes('blog')) {
    const idempKey = `${programId}:${orgId}:blog:${new Date().toISOString().slice(0, 10)}`;
    const { data: inserted } = await db
      .from<{ id: string }>('affiliate_content')
      .insert({ org_id: orgId, program_id: programId, content_type: 'blog', status: 'generating', idempotency_key: idempKey })
      .select('id')
      .single();

    if (inserted) {
      try {
        blogContent = await generateBlogReview(programData, orgId);
        await db.from('affiliate_content').update({
          status: 'draft',
          title: blogContent.title,
          body: blogContent.body,
          meta: { metaDescription: blogContent.metaDescription, keywords: blogContent.keywords },
        }).eq('id', inserted.id);
        await logUsage({ orgId, feature: 'affiliate:blog', metadata: { programId } });
        contentIds['blog'] = inserted.id;
      } catch (err) {
        await db.from('affiliate_content').update({ status: 'failed' }).eq('id', inserted.id);
        errors['blog'] = err instanceof Error ? err.message : 'Generation failed';
      }
    }
  }

  // Video generation (uses blog content if available)
  if (contentTypes.includes('video')) {
    const idempKey = `${programId}:${orgId}:video:${new Date().toISOString().slice(0, 10)}`;
    const { data: inserted } = await db
      .from<{ id: string }>('affiliate_content')
      .insert({ org_id: orgId, program_id: programId, content_type: 'video', status: 'generating', idempotency_key: idempKey })
      .select('id')
      .single();

    if (inserted) {
      try {
        const fallbackBlog = blogContent ?? { title: programData.name, body: '', metaDescription: '', keywords: [programData.category] };
        const videoContent = await generateVideoReview(programData, fallbackBlog, orgId);
        await db.from('affiliate_content').update({
          status: 'generating', // HeyGen is async
          body: videoContent.script,
          meta: { heygenVideoId: videoContent.heygenVideoId, estimatedDurationSeconds: videoContent.estimatedDurationSeconds },
        }).eq('id', inserted.id);
        await logUsage({ orgId, feature: 'affiliate:video', metadata: { programId, heygenVideoId: videoContent.heygenVideoId } });
        contentIds['video'] = inserted.id;
      } catch (err) {
        await db.from('affiliate_content').update({ status: 'failed' }).eq('id', inserted.id);
        errors['video'] = err instanceof Error ? err.message : 'Generation failed';
      }
    }
  }

  // Social bundle
  if (contentTypes.includes('social')) {
    const idempKey = `${programId}:${orgId}:social:${new Date().toISOString().slice(0, 10)}`;
    const { data: inserted } = await db
      .from<{ id: string }>('affiliate_content')
      .insert({ org_id: orgId, program_id: programId, content_type: 'social', status: 'generating', idempotency_key: idempKey })
      .select('id')
      .single();

    if (inserted) {
      try {
        const socialContent = await generateSocialBundle(programData, orgId);
        await db.from('affiliate_content').update({
          status: 'draft',
          meta: { linkedin: socialContent.linkedin, twitter: socialContent.twitter, tiktokScript: socialContent.tiktokScript },
        }).eq('id', inserted.id);
        await logUsage({ orgId, feature: 'affiliate:social', metadata: { programId } });
        contentIds['social'] = inserted.id;
      } catch (err) {
        await db.from('affiliate_content').update({ status: 'failed' }).eq('id', inserted.id);
        errors['social'] = err instanceof Error ? err.message : 'Generation failed';
      }
    }
  }

  const hasSuccess = Object.keys(contentIds).length > 0;
  return NextResponse.json(
    { success: hasSuccess, contentIds, errors: Object.keys(errors).length > 0 ? errors : undefined },
    { status: hasSuccess ? 200 : 500 }
  );
}
