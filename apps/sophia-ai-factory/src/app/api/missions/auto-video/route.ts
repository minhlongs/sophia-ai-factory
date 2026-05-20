/**
 * POST /api/missions/auto-video
 *
 * Autonomous video-gen mission — runs the full chain (script → translate →
 * affiliate description → publish schedule) in one server-side flow. Returns
 * the missionId so the dashboard / Telegram bot can show progress.
 *
 * Auth: Better Auth session OR OpenClaw Bearer (resolved by the bridge layer).
 *
 * @module app/api/missions/auto-video
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserOrOpenclawBearer } from '@/seed/auth/openclaw-token';
import { runAutoVideoMission, AutoVideoMissionError } from '@/land/missions/auto-video-mission';

const BodySchema = z.object({
  topic: z.string().min(1).max(500),
  keywords: z.array(z.string()).max(10).optional(),
  primaryLanguage: z.enum(['en', 'vi']).optional(),
  secondaryLanguage: z.enum(['en', 'vi']).optional(),
  channelId: z.string().optional(),
  scheduledAt: z.number().int().positive().optional(),
  nicheHint: z.string().max(80).optional(),
  maxAffiliateLinks: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserOrOpenclawBearer(req.headers);
  if (!user?.id) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues : 'invalid body';
    return NextResponse.json({ error: 'INVALID_INPUT', details: msg }, { status: 400 });
  }

  try {
    const result = await runAutoVideoMission({ userId: user.id, ...body });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof AutoVideoMissionError) {
      const status = err.code === 'BYOK_REQUIRED' ? 412 : err.code === 'EMPTY_TOPIC' ? 400 : 500;
      return NextResponse.json(
        { error: err.code, message: err.message, missionId: err.missionId },
        { status },
      );
    }
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
