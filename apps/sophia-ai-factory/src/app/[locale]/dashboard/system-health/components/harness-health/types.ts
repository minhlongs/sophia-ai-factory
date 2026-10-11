/**
 * Harness Health Card Types
 * Layer: app/[locale]/dashboard/system-health/components/harness-health
 */

export interface HarnessResult {
  test_name: string;
  status: 'success' | 'failed';
  duration_ms: number;
  error_message: string | null;
  metadata: string | null;
}

export interface HarnessJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  triggered_by: string;
  created_at: string;
  updated_at: string;
  results: HarnessResult[];
}

export interface HarnessStatusResponse {
  success: boolean;
  daemon: {
    status: 'ONLINE' | 'OFFLINE';
    last_poll: string | null;
  };
  latestJob: HarnessJob | null;
}
