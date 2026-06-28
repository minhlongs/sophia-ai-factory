-- ROI Calculator Migration
-- Migration: Add ROI calculator tables for AI automation cost savings
-- Date: 2026-03-08
-- Description: Create tables for ROI calculator configuration, user calculations,
--              benchmarks, and automation scenarios
-- ============================================================================
-- UP MIGRATION
-- ============================================================================

-- 1. Create roi_calculator_configs table
CREATE TABLE IF NOT EXISTS roi_calculator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_roi_calc_configs_active
    ON roi_calculator_configs(is_active) WHERE is_active = true;

-- 2. Create roi_calculations table
CREATE TABLE IF NOT EXISTS roi_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    session_id TEXT,
    inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    results JSONB NOT NULL DEFAULT '{}'::jsonb,
    monthly_savings NUMERIC(12,2),
    annual_savings NUMERIC(12,2),
    roi_percentage NUMERIC(8,2),
    payback_months NUMERIC(6,2),
    automation_type TEXT,
    industry TEXT,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roi_calculations_user
    ON roi_calculations(user_id);

CREATE INDEX IF NOT EXISTS idx_roi_calculations_created
    ON roi_calculations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_roi_calculations_industry
    ON roi_calculations(industry) WHERE industry IS NOT NULL;

-- 3. Create roi_benchmarks table
CREATE TABLE IF NOT EXISTS roi_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry TEXT NOT NULL,
    automation_type TEXT NOT NULL,
    company_size TEXT,
    region TEXT DEFAULT 'Vietnam',
    avg_hourly_cost NUMERIC(10,2),
    avg_automation_rate NUMERIC(5,4),
    avg_time_saved_pct NUMERIC(5,4),
    avg_error_reduction_pct NUMERIC(5,4),
    sample_size INTEGER,
    data_source TEXT,
    is_verified BOOLEAN DEFAULT false,
    valid_from DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roi_benchmarks_unique
    ON roi_benchmarks(industry, automation_type, company_size, region, valid_from);

CREATE INDEX IF NOT EXISTS idx_roi_benchmarks_industry
    ON roi_benchmarks(industry);

-- 4. Create roi_automation_scenarios table
CREATE TABLE IF NOT EXISTS roi_automation_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT NOT NULL,
    icon TEXT,
    default_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    formula_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roi_scenarios_category
    ON roi_automation_scenarios(category);

CREATE INDEX IF NOT EXISTS idx_roi_scenarios_active
    ON roi_automation_scenarios(is_active) WHERE is_active = true;

-- 5. Create roi_industry_presets table
CREATE TABLE IF NOT EXISTS roi_industry_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry TEXT NOT NULL,
    preset_name TEXT NOT NULL,
    description TEXT,
    default_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommended_scenarios UUID[] DEFAULT '{}',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roi_presets_unique
    ON roi_industry_presets(industry, preset_name);

-- 6. Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_roi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Apply updated_at triggers
DROP TRIGGER IF EXISTS trg_roi_calc_configs_updated ON roi_calculator_configs;
CREATE TRIGGER trg_roi_calc_configs_updated
    BEFORE UPDATE ON roi_calculator_configs
    FOR EACH ROW EXECUTE FUNCTION update_roi_updated_at();

DROP TRIGGER IF EXISTS trg_roi_calculations_updated ON roi_calculations;
CREATE TRIGGER trg_roi_calculations_updated
    BEFORE UPDATE ON roi_calculations
    FOR EACH ROW EXECUTE FUNCTION update_roi_updated_at();

DROP TRIGGER IF EXISTS trg_roi_scenarios_updated ON roi_automation_scenarios;
CREATE TRIGGER trg_roi_scenarios_updated
    BEFORE UPDATE ON roi_automation_scenarios
    FOR EACH ROW EXECUTE FUNCTION update_roi_updated_at();

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================

-- DROP TRIGGER IF EXISTS trg_roi_scenarios_updated ON roi_automation_scenarios;
-- DROP TRIGGER IF EXISTS trg_roi_calculations_updated ON roi_calculations;
-- DROP TRIGGER IF EXISTS trg_roi_calc_configs_updated ON roi_calculator_configs;
-- DROP FUNCTION IF EXISTS update_roi_updated_at();
-- DROP TABLE IF EXISTS roi_industry_presets;
-- DROP TABLE IF EXISTS roi_automation_scenarios;
-- DROP TABLE IF EXISTS roi_benchmarks;
-- DROP TABLE IF EXISTS roi_calculations;
-- DROP TABLE IF EXISTS roi_calculator_configs;

-- End of migration
