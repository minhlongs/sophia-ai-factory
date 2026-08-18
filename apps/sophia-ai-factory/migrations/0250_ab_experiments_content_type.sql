-- Add content_type to ab_experiments to support caption/hook/CTA experiments
-- DEFAULT 'thumbnail' ensures existing rows and thumbnail-only flow unchanged
ALTER TABLE ab_experiments ADD COLUMN content_type TEXT NOT NULL DEFAULT 'thumbnail';
