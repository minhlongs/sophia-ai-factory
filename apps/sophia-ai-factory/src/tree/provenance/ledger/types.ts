export interface ProvenanceRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  agent_run_id: string | null;
  action: string;
  actor_type: string;
  actor_id: string;
  model: string | null;
  model_version: string | null;
  prompt: string | null;
  source_asset_id: string | null;
  human_edits: string | null;
  approval_id: string | null;
  derivative_of: string | null;
  metadata: string;
  created_at: number;
}
