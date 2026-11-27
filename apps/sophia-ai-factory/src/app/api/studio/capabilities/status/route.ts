import { NextResponse } from 'next/server';
import { SOPHIA_STUDIO_CAPABILITIES } from '@/seed/ui/studio-capability-registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const simpleModeCount = SOPHIA_STUDIO_CAPABILITIES.filter((c) => c.simpleModeVisible).length;
  const inspectorOnlyCount = SOPHIA_STUDIO_CAPABILITIES.length - simpleModeCount;

  return NextResponse.json({
    ok: true,
    roundsCovered: '1-19',
    totalEngines: SOPHIA_STUDIO_CAPABILITIES.length,
    simpleModeCount,
    inspectorOnlyCount,
    capabilities: SOPHIA_STUDIO_CAPABILITIES.map((c) => ({
      id: c.id,
      round: c.round,
      category: c.category,
      status: c.status,
      simpleModeVisible: c.simpleModeVisible,
      modulePath: c.modulePath,
    })),
  });
}
