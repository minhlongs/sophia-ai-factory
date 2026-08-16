-- Migration 0231: Add WhatsApp approval gate flag
-- First WhatsApp publish requires explicit user approval.
-- This column tracks whether the user has approved outbound WhatsApp sends.

ALTER TABLE whatsapp_templates ADD COLUMN whatsapp_approved INTEGER NOT NULL DEFAULT 0;
