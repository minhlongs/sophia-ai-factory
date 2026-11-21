/**
 * /api/campaigns/[id]/export — Private customer export for persisted campaign scripts
 *
 * GET /api/campaigns/[id]/export                — JSON export (default)
 * GET /api/campaigns/[id]/export?format=markdown — Markdown attachment download
 *
 * Auth: requires valid Better Auth session + strict user_id tenant isolation.
 * Cache: private, no-store.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
} as const;

interface CampaignExportRow {
  id: string;
  user_id: string;
  title: string | null;
  status: string;
  script_content: unknown;
  video_url?: string | null;
}

function parseScriptContent(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function sanitizeFilenameSegment(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.length > 0 ? cleaned : 'export';
}

function renderScriptMarkdown(params: {
  campaignId: string;
  title: string;
  status: string;
  deliveryMode: 'text_only' | 'full_video';
  script: Record<string, unknown>;
}): string {
  const { campaignId, title, status, deliveryMode, script } = params;
  const scriptTitle =
    typeof script.title === 'string' && script.title.trim().length > 0
      ? script.title.trim()
      : title;

  const lines: string[] = [
    `# ${scriptTitle}`,
    '',
    `- **Campaign ID:** ${campaignId}`,
    `- **Status:** ${status}`,
    `- **Delivery Mode:** ${deliveryMode}`,
    `- **Public Auto-Publish:** ${deliveryMode === 'text_only' ? 'false' : 'unknown'}`,
  ];

  if (typeof script.total_duration === 'number') {
    lines.push(`- **Estimated Duration:** ${script.total_duration}s`);
  }

  const scenes = Array.isArray(script.scenes) ? script.scenes : null;
  if (scenes && scenes.length > 0) {
    lines.push('', '## Scenes', '');
    for (let i = 0; i < scenes.length; i++) {
      const candidate: unknown = scenes[i];
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
      const scene = candidate as Record<string, unknown>;
      const sceneNum = typeof scene.scene_number === 'number' ? scene.scene_number : i + 1;
      const duration =
        typeof scene.duration_estimate === 'number' ? ` (${scene.duration_estimate}s)` : '';
      lines.push(`### Scene ${sceneNum}${duration}`);
      if (typeof scene.visual_description === 'string' && scene.visual_description.trim()) {
        lines.push(`- **Visual:** ${scene.visual_description.trim()}`);
      }
      if (typeof scene.narration === 'string' && scene.narration.trim()) {
        lines.push(`- **Narration:** ${scene.narration.trim()}`);
      }
      lines.push('');
    }
  } else {
    lines.push('', '## Script', '', '```json', JSON.stringify(script, null, 2), '```', '');
  }

  return lines.join('\n');
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized / Bạn cần đăng nhập' },
        { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const { id } = await context.params;
    const campaignId = typeof id === 'string' ? id.trim() : '';
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Invalid campaign ID / Mã chiến dịch không hợp lệ' },
        { status: 400, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const db = createServerClient();
    const { data, error } = await db
      .from('campaigns')
      .select('id, user_id, title, status, script_content, video_url')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Campaign not found / Không tìm thấy chiến dịch' },
        { status: 404, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const campaign = data as unknown as CampaignExportRow;
    if (campaign.status !== 'completed') {
      return NextResponse.json(
        { error: 'Campaign is not completed and cannot be exported / Chiến dịch chưa hoàn tất nên chưa thể tải xuống' },
        { status: 409, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const script = parseScriptContent(campaign.script_content);
    if (!script) {
      return NextResponse.json(
        { error: 'Campaign script is not yet available for export / Kịch bản chiến dịch chưa sẵn sàng để tải xuống' },
        { status: 409, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    const deliveryMode: 'text_only' | 'full_video' = campaign.video_url
      ? 'full_video'
      : 'text_only';
    const publicPublished = deliveryMode === 'text_only' ? false : null;
    const title = campaign.title || 'Untitled Campaign';
    const format = req.nextUrl.searchParams.get('format')?.toLowerCase();

    if (format === 'markdown') {
      const safeId = sanitizeFilenameSegment(campaign.id);
      const markdown = renderScriptMarkdown({
        campaignId: campaign.id,
        title,
        status: campaign.status,
        deliveryMode,
        script,
      });

      return new NextResponse(markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="campaign-${safeId}-script.md"`,
          ...PRIVATE_NO_STORE_HEADERS,
        },
      });
    }

    return NextResponse.json(
      {
        campaignId: campaign.id,
        title,
        status: campaign.status,
        deliveryMode,
        publicPublished,
        script,
      },
      {
        status: 200,
        headers: PRIVATE_NO_STORE_HEADERS,
      },
    );
  } catch (err) {
    logger.error('[GET /api/campaigns/[id]/export] Unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: 'Failed to export campaign script / Không thể tải xuống kịch bản chiến dịch' },
      { status: 500, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}
