-- ═══════════════════════════════════════════════════════════════
-- BLACKOPS DM INTELLIGENCE PLATFORM — Complete Database Schema
-- ═══════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- ═══════════════════════════════════════════════════════════════
-- CUSTOM TYPES (ENUMS)
-- ═══════════════════════════════════════════════════════════════

CREATE TYPE user_role AS ENUM ('admin', 'setter', 'viewer');
CREATE TYPE user_status AS ENUM ('online', 'offline', 'away');
CREATE TYPE lead_source AS ENUM ('dm', 'story_reply', 'comment', 'follow', 'keyword');
CREATE TYPE lead_stage AS ENUM (
  'new', 'contacted', 'qualifying', 'call_offered', 'call_booked',
  'showed', 'no_show', 'won', 'lost', 'disqualified'
);
CREATE TYPE assignment_type AS ENUM ('setter1', 'setter2', 'ai');
CREATE TYPE conversation_status AS ENUM ('active', 'closed', 'paused');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_type AS ENUM ('text', 'voice', 'image', 'template', 'ai_generated');
CREATE TYPE keyword_match_type AS ENUM ('exact', 'contains', 'starts_with', 'regex');
CREATE TYPE keyword_source AS ENUM ('dm', 'story_reply', 'comment', 'follow', 'any');
CREATE TYPE kb_document_type AS ENUM ('offer', 'script', 'persona', 'training', 'general');
CREATE TYPE qualification_field_type AS ENUM ('text', 'number', 'boolean', 'select');
CREATE TYPE voice_reply_mode AS ENUM ('always', 'never', 'contextual');
CREATE TYPE distribution_mode AS ENUM ('percentage', 'round_robin', 'load_based');
CREATE TYPE notification_type AS ENUM ('hot_lead', 'call_booked', 'disqualified', 'setter_offline', 'ai_takeover');
CREATE TYPE follow_up_job_status AS ENUM ('active', 'paused', 'completed', 'cancelled');
CREATE TYPE training_outcome AS ENUM ('success', 'failure', 'partial');

-- ═══════════════════════════════════════════════════════════════
-- TABLE 1: users
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'setter',
  slack_user_id TEXT,
  status user_status NOT NULL DEFAULT 'offline',
  avatar_url TEXT,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 2: leads
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instagram_user_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT,
  bio TEXT,
  follower_count INTEGER,
  profile_pic_url TEXT,
  source lead_source NOT NULL DEFAULT 'dm',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assignment_type assignment_type NOT NULL DEFAULT 'ai',
  stage lead_stage NOT NULL DEFAULT 'new',
  heat_score INTEGER NOT NULL DEFAULT 0 CHECK (heat_score >= 0 AND heat_score <= 100),
  qualification_fields JSONB NOT NULL DEFAULT '{}',
  calendly_booked_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 3: conversations
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status conversation_status NOT NULL DEFAULT 'active',
  summary TEXT,
  summary_updated_at TIMESTAMPTZ,
  qualified_fields_collected JSONB NOT NULL DEFAULT '{}',
  qualification_score INTEGER NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  follow_up_sequence_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 4: messages
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  type message_type NOT NULL DEFAULT 'text',
  content TEXT NOT NULL DEFAULT '',
  voice_url TEXT,
  manychat_message_id TEXT,
  sent_by TEXT, -- user_id, 'ai', 'system', or 'lead'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  template_id UUID,
  bundle_id UUID
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 5: ai_suggestions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE ai_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  suggestion_1 TEXT NOT NULL,
  suggestion_2 TEXT NOT NULL,
  reasoning TEXT NOT NULL DEFAULT '',
  confidence_score INTEGER NOT NULL DEFAULT 0,
  context_snapshot JSONB NOT NULL DEFAULT '{}',
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_suggestion INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 6: templates
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 7: follow_up_sequences
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK now that follow_up_sequences exists
ALTER TABLE conversations
  ADD CONSTRAINT fk_conversations_follow_up_sequence
  FOREIGN KEY (follow_up_sequence_id) REFERENCES follow_up_sequences(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════
-- TABLE 8: follow_up_jobs
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE follow_up_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  next_fire_at TIMESTAMPTZ NOT NULL,
  status follow_up_job_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 9: keyword_triggers
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE keyword_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT NOT NULL,
  match_type keyword_match_type NOT NULL DEFAULT 'contains',
  source keyword_source NOT NULL DEFAULT 'any',
  response_template TEXT NOT NULL DEFAULT '',
  webhook_endpoint TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 10: kb_documents
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE kb_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  type kb_document_type NOT NULL DEFAULT 'general',
  file_url TEXT,
  file_type TEXT,
  embedding vector(1536),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 11: qualification_fields
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE qualification_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_key TEXT UNIQUE NOT NULL,
  field_label TEXT NOT NULL,
  field_type qualification_field_type NOT NULL DEFAULT 'text',
  options JSONB,
  weight INTEGER NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 12: persona_settings
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE persona_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  base_prompt TEXT NOT NULL DEFAULT '',
  style_rules JSONB NOT NULL DEFAULT '{}',
  language_rules JSONB NOT NULL DEFAULT '{}',
  is_global BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 13: setter_ai_settings
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE setter_ai_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_style TEXT NOT NULL DEFAULT 'balanced',
  custom_prompt_additions TEXT NOT NULL DEFAULT '',
  suggestions_count INTEGER NOT NULL DEFAULT 2,
  auto_score_leads BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 14: autopilot_settings (single row)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE autopilot_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  min_delay_seconds INTEGER NOT NULL DEFAULT 8,
  max_delay_seconds INTEGER NOT NULL DEFAULT 45,
  max_messages_per_burst INTEGER NOT NULL DEFAULT 3,
  burst_delay_ms INTEGER NOT NULL DEFAULT 2500,
  auto_qualify BOOLEAN NOT NULL DEFAULT TRUE,
  auto_disqualify BOOLEAN NOT NULL DEFAULT FALSE,
  auto_send_calendly BOOLEAN NOT NULL DEFAULT FALSE,
  voice_reply_on_voice voice_reply_mode NOT NULL DEFAULT 'contextual',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 15: distribution_settings (single row)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE distribution_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setter1_id UUID REFERENCES users(id) ON DELETE SET NULL,
  setter2_id UUID REFERENCES users(id) ON DELETE SET NULL,
  setter1_pct INTEGER NOT NULL DEFAULT 33,
  setter2_pct INTEGER NOT NULL DEFAULT 33,
  ai_pct INTEGER NOT NULL DEFAULT 34,
  distribution_mode distribution_mode NOT NULL DEFAULT 'percentage',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pct_sum_100 CHECK (setter1_pct + setter2_pct + ai_pct = 100)
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 16: notifications
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  slack_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 17: training_conversations
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE training_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  conversation_data JSONB NOT NULL DEFAULT '{}',
  outcome training_outcome NOT NULL DEFAULT 'partial',
  feedback_notes TEXT,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- TABLE 18: audit_log
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor TEXT NOT NULL, -- user_id, 'ai', or 'system'
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

-- leads
CREATE INDEX idx_leads_instagram_user_id ON leads(instagram_user_id);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_leads_heat_score ON leads(heat_score);
CREATE INDEX idx_leads_last_message_at ON leads(last_message_at DESC);

-- messages
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_lead_id ON messages(lead_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at DESC);
CREATE INDEX idx_messages_direction ON messages(direction);
CREATE INDEX idx_messages_bundle_id ON messages(bundle_id);

-- conversations
CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_conversations_assigned_to ON conversations(assigned_to);
CREATE INDEX idx_conversations_status ON conversations(status);

-- follow_up_jobs (queue polling)
CREATE INDEX idx_follow_up_jobs_next_fire ON follow_up_jobs(next_fire_at, status)
  WHERE status = 'active';

-- kb_documents (vector similarity search)
CREATE INDEX idx_kb_documents_embedding ON kb_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read)
  WHERE read = FALSE;

-- audit_log
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER (auto-update timestamps)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_setter_ai_settings_updated_at
  BEFORE UPDATE ON setter_ai_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_autopilot_settings_updated_at
  BEFORE UPDATE ON autopilot_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_distribution_settings_updated_at
  BEFORE UPDATE ON distribution_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE setter_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── users ──
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid() OR is_admin());

CREATE POLICY "users_insert_admin" ON users
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "users_delete_admin" ON users
  FOR DELETE USING (is_admin());

-- ── leads ──
CREATE POLICY "leads_select" ON leads
  FOR SELECT USING (
    is_admin()
    OR assigned_to = auth.uid()
    OR assigned_to IS NULL
  );

CREATE POLICY "leads_insert" ON leads
  FOR INSERT WITH CHECK (is_admin() OR get_user_role() = 'setter');

CREATE POLICY "leads_update" ON leads
  FOR UPDATE USING (
    is_admin()
    OR assigned_to = auth.uid()
  );

CREATE POLICY "leads_delete_admin" ON leads
  FOR DELETE USING (is_admin());

-- ── conversations ──
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    is_admin()
    OR assigned_to = auth.uid()
    OR assigned_to IS NULL
  );

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (is_admin() OR get_user_role() = 'setter');

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (
    is_admin()
    OR assigned_to = auth.uid()
  );

CREATE POLICY "conversations_delete_admin" ON conversations
  FOR DELETE USING (is_admin());

-- ── messages ──
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
    )
  );

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    is_admin()
    OR get_user_role() = 'setter'
  );

CREATE POLICY "messages_update" ON messages
  FOR UPDATE USING (is_admin());

-- ── ai_suggestions ──
CREATE POLICY "ai_suggestions_select" ON ai_suggestions
  FOR SELECT USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = ai_suggestions.conversation_id
      AND c.assigned_to = auth.uid()
    )
  );

CREATE POLICY "ai_suggestions_insert" ON ai_suggestions
  FOR INSERT WITH CHECK (is_admin() OR get_user_role() = 'setter');

CREATE POLICY "ai_suggestions_update" ON ai_suggestions
  FOR UPDATE USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = ai_suggestions.conversation_id
      AND c.assigned_to = auth.uid()
    )
  );

-- ── templates (shared, everyone reads) ──
CREATE POLICY "templates_select" ON templates
  FOR SELECT USING (TRUE);

CREATE POLICY "templates_insert" ON templates
  FOR INSERT WITH CHECK (is_admin() OR get_user_role() = 'setter');

CREATE POLICY "templates_update" ON templates
  FOR UPDATE USING (is_admin() OR created_by = auth.uid());

CREATE POLICY "templates_delete" ON templates
  FOR DELETE USING (is_admin());

-- ── follow_up_sequences (admin manages, setters read) ──
CREATE POLICY "follow_up_sequences_select" ON follow_up_sequences
  FOR SELECT USING (TRUE);

CREATE POLICY "follow_up_sequences_modify" ON follow_up_sequences
  FOR ALL USING (is_admin());

-- ── follow_up_jobs ──
CREATE POLICY "follow_up_jobs_select" ON follow_up_jobs
  FOR SELECT USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = follow_up_jobs.conversation_id
      AND c.assigned_to = auth.uid()
    )
  );

CREATE POLICY "follow_up_jobs_modify" ON follow_up_jobs
  FOR ALL USING (is_admin());

-- ── keyword_triggers (admin only) ──
CREATE POLICY "keyword_triggers_select" ON keyword_triggers
  FOR SELECT USING (TRUE);

CREATE POLICY "keyword_triggers_modify" ON keyword_triggers
  FOR ALL USING (is_admin());

-- ── kb_documents (everyone reads) ──
CREATE POLICY "kb_documents_select" ON kb_documents
  FOR SELECT USING (TRUE);

CREATE POLICY "kb_documents_modify" ON kb_documents
  FOR ALL USING (is_admin());

-- ── qualification_fields (everyone reads) ──
CREATE POLICY "qualification_fields_select" ON qualification_fields
  FOR SELECT USING (TRUE);

CREATE POLICY "qualification_fields_modify" ON qualification_fields
  FOR ALL USING (is_admin());

-- ── persona_settings (everyone reads) ──
CREATE POLICY "persona_settings_select" ON persona_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "persona_settings_modify" ON persona_settings
  FOR ALL USING (is_admin());

-- ── setter_ai_settings (own settings only) ──
CREATE POLICY "setter_ai_settings_select" ON setter_ai_settings
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "setter_ai_settings_update" ON setter_ai_settings
  FOR UPDATE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "setter_ai_settings_insert" ON setter_ai_settings
  FOR INSERT WITH CHECK (is_admin());

-- ── autopilot_settings (admin writes, everyone reads) ──
CREATE POLICY "autopilot_settings_select" ON autopilot_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "autopilot_settings_modify" ON autopilot_settings
  FOR ALL USING (is_admin());

-- ── distribution_settings (admin writes, everyone reads) ──
CREATE POLICY "distribution_settings_select" ON distribution_settings
  FOR SELECT USING (TRUE);

CREATE POLICY "distribution_settings_modify" ON distribution_settings
  FOR ALL USING (is_admin());

-- ── notifications (own notifications only) ──
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (TRUE); -- system/workers can create for any user

-- ── training_conversations (admin manages, setters read) ──
CREATE POLICY "training_conversations_select" ON training_conversations
  FOR SELECT USING (TRUE);

CREATE POLICY "training_conversations_modify" ON training_conversations
  FOR ALL USING (is_admin());

-- ── audit_log (admin reads, everyone inserts) ──
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (is_admin());

CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (TRUE);

-- ═══════════════════════════════════════════════════════════════
-- ENABLE REALTIME on key tables
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
