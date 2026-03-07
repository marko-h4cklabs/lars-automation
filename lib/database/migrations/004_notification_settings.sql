-- ═══════════════════════════════════════════════════════════════
-- Migration 004: notification_settings table
-- Stores Slack webhook URLs and per-type notification preferences
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slack_webhook_alerts TEXT,
  slack_webhook_system TEXT,
  hot_lead_mode TEXT NOT NULL DEFAULT 'slack_and_app',
  hot_lead_threshold INTEGER NOT NULL DEFAULT 80,
  call_booked_mode TEXT NOT NULL DEFAULT 'slack_and_app',
  setter_offline_mode TEXT NOT NULL DEFAULT 'app_only',
  ai_takeover_mode TEXT NOT NULL DEFAULT 'app_only',
  dnd_start TEXT,
  dnd_end TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_settings_select" ON notification_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "notification_settings_modify" ON notification_settings
  FOR ALL USING (is_admin());

-- Insert default row
INSERT INTO notification_settings (
  hot_lead_mode, hot_lead_threshold, call_booked_mode,
  setter_offline_mode, ai_takeover_mode
) VALUES (
  'slack_and_app', 80, 'slack_and_app',
  'app_only', 'app_only'
)
ON CONFLICT DO NOTHING;
