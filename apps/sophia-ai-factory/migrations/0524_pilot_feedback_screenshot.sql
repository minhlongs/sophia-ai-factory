-- Migration 0522: Add optional screenshot attachment column to pilot_feedback.
-- Additive, idempotent for sophia-pilot-db (bounded base64 data URL <= 700KB, PNG/JPEG/WebP only).

ALTER TABLE pilot_feedback ADD COLUMN screenshot_data_url TEXT;
