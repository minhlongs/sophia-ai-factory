export interface CampaignBlueprintRow {
  id: string;
  workspace_id: string;
  title?: string;
  name_en?: string;
  name_vi?: string;
  description?: string;
  description_en?: string;
  description_vi?: string;
  hook_style: string;
  target_platform: string;
  aspect_ratios?: string;
  aspect_ratio?: string;
  estimated_scenes?: number;
  estimated_duration_seconds?: number;
  duration_seconds?: number;
  estimated_cost_cents?: number;
  niche?: string;
  conversion_rate?: number;
  remix_count?: number;
  royalty_pct?: number;
  creator_id?: string;
  parent_blueprint_id?: string;
  created_at?: number;
}

export function parseAspectRatios(r: CampaignBlueprintRow): string[] {
  let aspectRatios = ['9:16'];
  if (r.aspect_ratios) {
    try {
      aspectRatios = JSON.parse(r.aspect_ratios);
    } catch {
      aspectRatios = [r.aspect_ratios];
    }
  } else if (r.aspect_ratio) {
    aspectRatios = [r.aspect_ratio];
  }
  return aspectRatios;
}
