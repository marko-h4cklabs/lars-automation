-- ═══════════════════════════════════════════════════════════════
-- Migration 010: Add manychat_subscriber_id to leads
-- ManyChat's sendContent API requires the subscriber ID (numeric),
-- not the Instagram username. This column stores it for sending.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE leads ADD COLUMN IF NOT EXISTS manychat_subscriber_id TEXT;
