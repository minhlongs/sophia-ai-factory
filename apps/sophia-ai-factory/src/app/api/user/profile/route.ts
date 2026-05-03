/**
 * GET /api/user/profile — returns display name, locale, timezone
 * PATCH /api/user/profile — updates display name, locale, timezone, onboarding flag
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { createServerClient } from '@/lib/db/client';

const PatchSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  locale: z.enum(['vi', 'en']).optional(),
  timezone: z.string().max(64).optional(),
  onboarding_completed: z.boolean().optional(),
}).strict();

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = createServerClient();
  const { data } = await db
    .from('user_profiles')
    .select('settings,onboarding_completed_at')
    .eq('user_id', user.id)
    .single();

  let settings: Record<string, unknown> = {};
  try {
    if (data?.settings) settings = JSON.parse(data.settings as string) as Record<string, unknown>;
  } catch { /* ignore */ }

  return NextResponse.json({
    email: user.email,
    display_name: (settings.display_name as string) ?? user.full_name ?? '',
    locale: (settings.locale as string) ?? 'en',
    timezone: (settings.timezone as string) ?? 'Asia/Ho_Chi_Minh',
    onboarding_completed_at: (data as Record<string, unknown> | null)?.onboarding_completed_at ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { display_name, locale, timezone, onboarding_completed } = parsed.data;

  const db = createServerClient();
  const { data: existing } = await db
    .from('user_profiles')
    .select('settings')
    .eq('user_id', user.id)
    .single();

  let settings: Record<string, unknown> = {};
  try {
    if (existing?.settings) settings = JSON.parse(existing.settings as string) as Record<string, unknown>;
  } catch { /* ignore */ }

  if (display_name !== undefined) settings.display_name = display_name;
  if (locale !== undefined) settings.locale = locale;
  if (timezone !== undefined) settings.timezone = timezone;

  const updatePayload: Record<string, unknown> = {
    settings: JSON.stringify(settings),
    updated_at: new Date().toISOString(),
  };

  if (onboarding_completed) {
    updatePayload.onboarding_completed_at = Math.floor(Date.now() / 1000);
  }

  const { error } = await db
    .from('user_profiles')
    .update(updatePayload)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
