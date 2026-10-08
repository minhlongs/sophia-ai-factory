-- Migration: 0454_creative_mutations.sql
-- Darwinian Creative Auto-Mutator Gene Lineage & Offspring Tracking

CREATE TABLE IF NOT EXISTS creative_mutations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  parent_job_id TEXT NOT NULL,
  offspring_job_id TEXT,
  generation INTEGER NOT NULL DEFAULT 0,
  mutation_intensity TEXT NOT NULL DEFAULT 'MODERATE',
  trigger_reason TEXT NOT NULL DEFAULT 'MANUAL',
  parent_gene TEXT NOT NULL,
  offspring_gene TEXT NOT NULL,
  delta TEXT NOT NULL,
  parent_fitness REAL NOT NULL DEFAULT 0.0,
  offspring_fitness REAL,
  status TEXT NOT NULL DEFAULT 'PENDING_RENDER',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cm_user_created ON creative_mutations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_parent_gen ON creative_mutations(parent_job_id, generation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_offspring ON creative_mutations(offspring_job_id);
