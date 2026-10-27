import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { runAgenticDiscoveryWave } from '@/land/affiliates/discovery-wave';

export interface AffiliateOffer {
  id: string;
  offer_name: string;
  network: string;
  url: string;
  commission_rate: number | null;
  category: string | null;
  description: string | null;
  created_at: string | null;
}

export const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const postSchema = z.object({
  niche: z.string().trim().min(1).max(100).default('saas'),
  minScore: z.number().min(0).max(1).default(0.5),
  limit: z.number().int().min(1).max(50).default(20),
  networks: z
    .array(
      z.enum([
        'clickbank',
        'awin',
        'shareasale',
        'cj',
        'impact',
        'partnerstack',
        'binance',
        'bybit',
        'bitget',
        'coinbase',
      ]),
    )
    .min(1)
    .default(['clickbank', 'awin', 'shareasale']),
});

export async function handleAffiliateDiscoveryGet(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);

  const parsed = querySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query params', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  try {
    const db = createServerClient();

    const [rowsResult, countResult] = await Promise.all([
      db
        .from('affiliate_offers_catalog')
        .select('id, offer_name, network, url, commission_rate, category, description, created_at')
        .eq('is_active', 1)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      db
        .from('affiliate_offers_catalog')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', 1),
    ]);

    const offers = (rowsResult.data ?? []) as unknown as AffiliateOffer[];
    const total = (countResult.count ?? 0) as number;

    return NextResponse.json({ offers, total, page });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function handleAffiliateDiscoveryPost(req: NextRequest): Promise<NextResponse> {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional; fallback to defaults
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const serverDb = createServerClient();
    const orgId = await resolveOrgId(user.id, serverDb).catch(() => null);
    const tenantId = orgId ?? user.id;
    const rawD1 = await getD1().catch(() => null);

    const result = await runAgenticDiscoveryWave({
      niche: parsed.data.niche,
      minScore: parsed.data.minScore,
      limit: parsed.data.limit,
      networks: parsed.data.networks,
      tenantId,
      ...(rawD1 ? { db: rawD1 } : {}),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.value);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Discovery wave execution failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
