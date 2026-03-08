-- ═══════════════════════════════════════════════════════════════
-- Migration 009: integration_settings table
-- Stores operational integration config (Calendly link, ManyChat Page ID)
-- Credentials (API keys, webhook secrets) stay in Vercel env vars
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  calendly_link TEXT DEFAULT '',
  manychat_page_id TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_settings_select" ON integration_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "integration_settings_modify" ON integration_settings
  FOR ALL USING (is_admin());

-- Insert default row so upserts work
INSERT INTO integration_settings (calendly_link, manychat_page_id)
VALUES ('', '')
ON CONFLICT DO NOTHING;
