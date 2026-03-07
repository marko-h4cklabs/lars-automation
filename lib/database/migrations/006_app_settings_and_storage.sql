-- ═══════════════════════════════════════════════════════════════
-- Migration 006: app_settings table + media storage bucket
-- Key-value store for voice settings, voice templates, and
-- template usage tracking. Also creates the 'media' storage
-- bucket for ElevenLabs voice note uploads.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- TABLE: app_settings
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: everyone reads, admin writes
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select" ON app_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "app_settings_modify" ON app_settings
  FOR ALL USING (is_admin());

-- Seed default voice settings
INSERT INTO app_settings (key, value) VALUES
  ('voice_settings', '{"enabled": false, "auto_voice": false, "voice_id": null, "stability": 0.5, "similarity_boost": 0.75}'),
  ('voice_templates', '[]')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════
-- STORAGE: media bucket
-- ═══════════════════════════════════════
-- Note: Supabase storage buckets are created via the
-- storage API, not SQL. Run the following in the Supabase
-- SQL Editor or create the bucket manually in the dashboard.

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can read, authenticated users can upload
CREATE POLICY "media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "media_authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "media_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'media'
    AND is_admin()
  );
