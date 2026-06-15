-- Compliance Reports Schema
-- Purpose: Store scheduled report configurations and generated report archives
-- Created: 2026-03-08

-- Scheduled reports configuration table
CREATE TABLE IF NOT EXISTS compliance_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('compliance', 'usage', 'billing')),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'csv', 'json')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  recipients TEXT[] NOT NULL DEFAULT '{}',
  filters JSONB NOT NULL DEFAULT '{}',
  next_run_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  created_by TEXT NOT NULL,
  created_at_ts TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at_ts TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated reports archive table
CREATE TABLE IF NOT EXISTS compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('compliance', 'usage', 'billing')),
  format TEXT NOT NULL CHECK (format IN ('pdf', 'csv', 'json')),
  generated_at BIGINT NOT NULL,
  generated_by TEXT NOT NULL,
  schedule_id UUID REFERENCES compliance_report_schedules(id) ON DELETE SET NULL,
  storage_path TEXT,
  file_size BIGINT,
  period_start BIGINT,
  period_end BIGINT,
  created_at_ts TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run
  ON compliance_report_schedules(next_run_at ASC);

CREATE INDEX IF NOT EXISTS idx_report_schedules_frequency
  ON compliance_report_schedules(frequency);

CREATE INDEX IF NOT EXISTS idx_report_schedules_created_by
  ON compliance_report_schedules(created_by);

CREATE INDEX IF NOT EXISTS idx_reports_generated_at
  ON compliance_reports(generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_report_type
  ON compliance_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_reports_schedule_id
  ON compliance_reports(schedule_id);

-- Comments for documentation
COMMENT ON TABLE compliance_report_schedules IS 'Stores scheduled compliance report configurations';
COMMENT ON TABLE compliance_reports IS 'Archive of generated compliance reports';

COMMENT ON COLUMN compliance_report_schedules.report_type IS 'Type of report: compliance, usage, or billing';
COMMENT ON COLUMN compliance_report_schedules.format IS 'Export format: pdf, csv, or json';
COMMENT ON COLUMN compliance_report_schedules.frequency IS 'Execution frequency: daily, weekly, monthly, quarterly';
COMMENT ON COLUMN compliance_report_schedules.recipients IS 'Email addresses of report recipients';
COMMENT ON COLUMN compliance_report_schedules.filters IS 'JSON filters: date range, license nonce, models, tiers, includePII';
COMMENT ON COLUMN compliance_report_schedules.next_run_at IS 'Unix timestamp of next scheduled execution';

COMMENT ON COLUMN compliance_reports.storage_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN compliance_reports.file_size IS 'File size in bytes';
COMMENT ON COLUMN compliance_reports.period_start IS 'Report period start Unix timestamp';
COMMENT ON COLUMN compliance_reports.period_end IS 'Report period end Unix timestamp';

-- Row Level Security (RLS) policies
ALTER TABLE compliance_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admins can view schedules"
  ON compliance_report_schedules
  FOR SELECT
  USING (true); -- Auth check done in API layer

CREATE POLICY "Admins can insert schedules"
  ON compliance_report_schedules
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update schedules"
  ON compliance_report_schedules
  FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete schedules"
  ON compliance_report_schedules
  FOR DELETE
  USING (true);

CREATE POLICY "Admins can view reports"
  ON compliance_reports
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert reports"
  ON compliance_reports
  FOR INSERT
  WITH CHECK (true);

-- Grant permissions to authenticated users (admin access controlled via API)
GRANT ALL ON compliance_report_schedules TO authenticated;
GRANT ALL ON compliance_reports TO authenticated;
