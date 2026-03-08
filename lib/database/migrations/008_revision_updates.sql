-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 008: Revision Updates (FIX 1-12)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Add 'setter' to assignment_type enum (FIX 2) ──
ALTER TYPE assignment_type ADD VALUE IF NOT EXISTS 'setter';

-- ── 2. users: receives_leads flag (FIX 2) ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS receives_leads BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 3. leads: stage history tracking ──
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_history JSONB NOT NULL DEFAULT '[]';

-- ── 4. conversations: message_count for smart keyword detection (FIX 9) ──
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0;

-- ── 5. conversations: prior ManyChat history flag (FIX 7) ──
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS has_prior_history BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 6. conversations: first contact tracking (FIX 5) ──
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS first_setter_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_replied_after_first_contact BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 7. messages: trigger outbound tracking (FIX 4, 9) ──
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_trigger_outbound BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS trigger_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS trigger_reply_tracked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS keyword_suppressed BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 8. qualification_fields: qualifying/disqualifying criteria (FIX 8) ──
ALTER TABLE qualification_fields ADD COLUMN IF NOT EXISTS qualifying_criteria TEXT;
ALTER TABLE qualification_fields ADD COLUMN IF NOT EXISTS disqualifying_criteria TEXT;

-- ── 9. distribution_settings: dynamic setter allocations (FIX 2) ──
ALTER TABLE distribution_settings ADD COLUMN IF NOT EXISTS setter_allocations JSONB NOT NULL DEFAULT '[]';

-- Drop the rigid pct_sum_100 constraint (now uses dynamic allocations)
ALTER TABLE distribution_settings DROP CONSTRAINT IF EXISTS pct_sum_100;

-- ── 10. Indexes for new columns ──
CREATE INDEX IF NOT EXISTS idx_messages_trigger_outbound ON messages(is_trigger_outbound)
  WHERE is_trigger_outbound = TRUE;

CREATE INDEX IF NOT EXISTS idx_messages_trigger_type ON messages(trigger_type)
  WHERE trigger_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_message_count ON conversations(message_count);

CREATE INDEX IF NOT EXISTS idx_conversations_has_prior_history ON conversations(has_prior_history)
  WHERE has_prior_history = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_receives_leads ON users(receives_leads)
  WHERE receives_leads = TRUE;

CREATE INDEX IF NOT EXISTS idx_conversations_first_setter_msg ON conversations(first_setter_message_id)
  WHERE first_setter_message_id IS NOT NULL;

-- ── 11. Backfill message_count on existing conversations ──
UPDATE conversations c
SET message_count = sub.cnt
FROM (
  SELECT conversation_id, COUNT(*) as cnt
  FROM messages
  GROUP BY conversation_id
) sub
WHERE c.id = sub.conversation_id
  AND c.message_count = 0;

-- ── 12. RLS for users select — allow setters to see all users (for team dropdown, FIX 1) ──
-- Drop old restrictive policy and create a more permissive one
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_authenticated" ON users
  FOR SELECT USING (auth.uid() IS NOT NULL);
