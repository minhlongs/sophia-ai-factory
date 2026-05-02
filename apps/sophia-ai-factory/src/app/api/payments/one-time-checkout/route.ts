import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOneTimeInvoiceUrl } from '@/lib/clients/nowpayments-client';
import { getOneTimeSkuById, ONE_TIME_SKUS } from '@/config/one-time-skus';
import { withRateLimit } from '@/middleware/rate-limit-wrapper';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';

const oneTimeCheckoutSchema = z.object({
  skuId: z.enum(Object.keys(ONE_TIME_SKUS) as [string, ...string[]]),
  userId: z.string().optional(),
});

async function resolveUserId(request: Request, override?: string): Promise<string | null> {
  if (override) return override;
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (user?.id) return user.id;
  } catch { /* auth failed */ }
  return null;
}

export const POST = withRateLimit(async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = oneTimeCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const sku = getOneTimeSkuById(parsed.data.skuId);
    if (!sku) {
      return NextResponse.json({ error: `Unknown SKU: ${parsed.data.skuId}` }, { status: 400 });
    }

    const userId = await resolveUserId(request, parsed.data.userId);
    if (!userId) {
      return NextResponse.json(
        { error: 'Login required before checkout. Please sign in first.' },
        { status: 401 }
      );
    }

    const url = createOneTimeInvoiceUrl(sku, userId);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create one-time checkout: ${message}` },
      { status: 500 }
    );
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });
