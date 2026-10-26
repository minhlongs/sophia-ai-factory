import { createServerClient } from '@/seed/db/client';
import type { Campaign, CampaignStatus } from '@/components/stitch/screens/campaigns/campaigns-page-types';

interface D1CampaignRow {
  id: string;
  title?: string | null;
  topic?: string | null;
  status?: string | null;
  progress?: number | null;
  created_at?: string | null;
}

function mapDbStatus(raw?: string | null): CampaignStatus {
  if (raw === 'completed' || raw === 'done') return 'done';
  if (raw === 'paused' || raw === 'failed') return 'paused';
  if (raw === 'running' || raw === 'active' || raw === 'live') return 'live';
  return 'draft';
}

export async function loadUserCampaigns(userId: string): Promise<Campaign[]> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('campaigns')
      .select('id, title, topic, status, progress, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const rows = (data as D1CampaignRow[] | null) ?? [];
    return rows.map((r) => {
      const status = mapDbStatus(r.status);
      const progress = typeof r.progress === 'number' ? r.progress : status === 'done' ? 100 : 15;
      return {
        id: r.id,
        title: r.title || r.topic || 'Untitled Campaign',
        status,
        channel: r.topic || 'Faceless YouTube',
        channels: ['youtube', 'tiktok'],
        thumbnail: null,
        metrics: { views: '-', revenue: '-', ctr: '-' },
        progress,
        progressLabel: 'Campaign Progress',
        lastPublished: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Just now',
        action: status === 'draft' ? 'Continue Draft' : 'View Details',
        actionLabel: status === 'draft' ? 'continueDraft' : 'viewDetails',
      };
    });
  } catch {
    return [];
  }
}

export async function deleteUserCampaign(
  userId: string,
  campaignId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = createServerClient();
    await db
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('user_id', userId);
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to delete campaign' };
  }
}
