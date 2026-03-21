/**
 * POST /api/affiliate/content/generate
 *
 * Generate AI content (blog/video/social) for an affiliate program.
 * Pre-deducts MCU; refunds on failure. Idempotent via unique key.
 * Max cost: 50 (blog) + 200 (video) + 10 (social) = 260 MCU.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
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
  const orgId = req.headers.get('x-org-id');
  if (!orgId) {
    return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
  }

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
    .from('affiliate_programs')
    .select('*')
    .eq('id', programId)
    .eq('org_id', orgId)
    .single();

  if (pgErr || !program) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  const contentIds: Record<string, string> = {};
  const errors: Record<string, string> = {};

  // Generate blog first (video-generator needs blog content)
  let blogContent = null;

  if (contentTypes.includes('blog')) {
    const idempKey = `${programId}:${orgId}:blog:${new Date().toISOString().slice(0, 10)}`;
    const { data: inserted } = await db
      .from('affiliate_content')
      .insert({ org_id: orgId, program_id: programId, content_type: 'blog', status: 'generating', idempotency_key: idempKey })
      .select('id')
      .single();

    if (inserted) {
      try {
        blogContent = await generateBlogReview(program, orgId);
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
      .from('affiliate_content')
      .insert({ org_id: orgId, program_id: programId, content_type: 'video', status: 'generating', idempotency_key: idempKey })
      .select('id')
      .single();

    if (inserted) {
      try {
        const fallbackBlog = blogContent ?? { title: program.name, body: '', metaDescription: '', keywords: [program.category] };
        const videoContent = await generateVideoReview(program, fallbackBlog, orgId);
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
      .from('affiliate_content')
      .insert({ org_id: orgId, program_id: programId, content_type: 'social', status: 'generating', idempotency_key: idempKey })
      .select('id')
      .single();

    if (inserted) {
      try {
        const socialContent = await generateSocialBundle(program, orgId);
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
