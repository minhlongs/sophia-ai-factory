/**
 * RaaS (Robot-as-a-Service) Types
 *
 * TypeScript interfaces for missions, templates, PEV execution system.
 */

// ============================================================================
// ENUMS / UNIONS
// ============================================================================

export type MissionStatus =
  | 'queued'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed';

export type MissionPriority = 'low' | 'normal' | 'high' | 'urgent';

export type MissionCategory =
  | 'proposal'
  | 'video'
  | 'affiliate'
  | 'content'
  | 'analytics';

export type MissionCommand =
  | 'proposal:create'
  | 'video:create'
  | 'affiliate:generate'
  | 'affiliate:scrape'
  | 'content:blog'
  | 'content:social'
  | 'crm:sync'
  | 'analytics:export'
  | 'gtm:campaign'
  | 'sales:battlecard';

// ============================================================================
// CORE TABLE TYPES
// ============================================================================

export interface Mission {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  command: MissionCommand;
  params: Record<string, unknown>;
  status: MissionStatus;
  priority: MissionPriority;
  mcu_cost: number;
  mcu_reserved: number;
  result: MissionResult | null;
  error_message: string | null;
  plan: PEVPlan | null;
  execution_log: PEVStep[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // OpenClaw engine fields (added by migration 011)
  max_retries: number;
  retry_count: number;
  parent_mission_id: string | null;
  webhook_url: string | null;
  is_sub_mission: boolean;
}

export interface MissionTemplate {
  id: string;
  name: string;
  command: MissionCommand;
  description: string | null;
  default_params: Record<string, unknown>;
  mcu_cost: number;
  category: MissionCategory;
  is_active: boolean;
  icon: string | null;
  created_at: string;
}

// ============================================================================
// PEV TYPES (Plan → Execute → Verify)
// ============================================================================

export interface PEVStep {
  step: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  started_at?: string;
  completed_at?: string;
  details?: string;
}

export interface PEVPlan {
  command: string;
  steps: PEVStep[];
  estimated_duration_ms: number;
}

// ============================================================================
// RESULT TYPE
// ============================================================================

export interface MissionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  output_url?: string;
  summary?: string;
}

// ============================================================================
// API REQUEST/RESPONSE
// ============================================================================

export interface CreateMissionRequest {
  title: string;
  command: MissionCommand;
  params?: Record<string, unknown>;
  priority?: MissionPriority;
  description?: string;
}

export interface MissionListResponse {
  missions: Mission[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================================
// OPENCLAW ENGINE TYPES (appended — do not modify types above)
// ============================================================================

export interface SubMissionDef {
  command: MissionCommand;
  title: string;
  params: Record<string, unknown>;
  dependency_type: 'sequential' | 'parallel';
}

export interface MissionDependency {
  id: string;
  parent_mission_id: string;
  child_mission_id: string;
  dependency_type: 'sequential' | 'parallel';
  created_at: string;
}

export interface MissionRetry {
  id: string;
  mission_id: string;
  attempt_number: number;
  error_message: string | null;
  retried_at: string;
}
