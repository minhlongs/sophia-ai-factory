/**
 * POST /api/v1/demo-requests
 *
 * Captures demo booking requests. Stores in D1 for follow-up.
 * Public endpoint — no auth required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';
import { z } from 'zod';

const DemoRequestSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  company: z.string().max(200).optional().default(''),
  message: z.string().max(2000).optional().default(''),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = DemoRequestSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, company, message } = validated.data;
    const db = await getD1Client();

    await db.from('demo_requests').insert({
      name,
      email,
      company,
      message,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Demo request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
