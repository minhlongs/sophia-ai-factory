import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { contextOverflowLog } from '@/seed/ai/context-overflow-log';
import { logger } from '@/seed/utils/logger-utility';
import { getUserTier } from '@/seed/db/get-user-tier';

export async function GET(req: NextRequest) {
  try {
    // 1. Authentication check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Admin tier check
    const tier = await getUserTier(user.id);
    if (tier !== 'MASTER') {
      return NextResponse.json({ error: 'Forbidden: Master tier required' }, { status: 403 });
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(req.url);
    const hoursParam = searchParams.get('hours');
    const hours = hoursParam ? parseInt(hoursParam, 10) : 24;

    if (isNaN(hours) || hours <= 0) {
      return NextResponse.json({ error: 'Invalid hours parameter' }, { status: 400 });
    }

    // 4. Fetch data from D1
    const events = await contextOverflowLog.getByTimeRange(hours);
    const statsData = await contextOverflowLog.getStatsByTimeRange(hours);

    // 5. Compute aggregated stats
    const total = events.length;
    const byLayer: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    let totalTokens = 0;

    events.forEach(event => {
      // Note: agent_id is used as the layer/agent identifier in the log table
      const layer = event.agent_id || 'unknown';
      const provider = event.provider || 'unknown';

      byLayer[layer] = (byLayer[layer] || 0) + 1;
      byModel[provider] = (byModel[provider] || 0) + 1;
      totalTokens += event.tokens_used || 0;
    });

    const avgTokens = total > 0 ? totalTokens / total : 0;

    logger.info(`[AdminAPI] Context overflow stats requested for last ${hours}h. Found ${total} events.`, {
      userId: user.id,
      hours,
    });

    return NextResponse.json({
      events,
      stats: {
        total,
        byLayer,
        byModel,
        avgTokens,
        timeRangeHours: hours,
      },
    });

  } catch (error) {
    logger.error(`[AdminAPI] Error fetching context overflow logs:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
