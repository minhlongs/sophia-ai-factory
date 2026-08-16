/**
 * POST /api/admin/promo-codes/create
 * Create a new promo code.
 * Admin only.
 * @module app/api/admin/promo-codes/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { createCode, getCodeByCode } from '@/land/promo/promo-repo';

export const dynamic = 'force-dynamic';

const createCodeSchema = z.object({
  code: z
    .string()
    .min(4)
    .max(20)
    .regex(/^[A-Z0-9]+$/, 'Code must be uppercase letters and digits only'),
  description: z.string().max(200).optional(),
  discountType: z.enum(['percent_off', 'fixed_off', 'free_trial', 'free_full']),
  discountValue: z.number().int().min(0).max(100000),
  appliesToTier: z.string().optional(),
  appliesToSku: z.string().optional(),
  maxUses: z.number().int().positive().optional(),
  maxUsesPerUser: z.number().int().positive().default(1),
  validUntil: z.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;

  const { user: admin } = auth;

  try {
    const body = await request.json() as Record<string, unknown>;
    const upperCode = typeof body.code === 'string' ? body.code.toUpperCase() : body.code;
    const parsed = createCodeSchema.safeParse({ ...body, code: upperCode });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Check uniqueness
    const existing = await getCodeByCode(parsed.data.code);
    if (existing) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    }

    const created = await createCode(parsed.data, admin.id);
    return NextResponse.json({ code: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Create failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
