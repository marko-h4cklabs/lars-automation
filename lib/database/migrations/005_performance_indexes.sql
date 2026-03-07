-- ═══════════════════════════════════════════════════════════════
-- Migration 005: Performance indexes + materialized views
-- Optimizes for 30,000 DMs/day scale
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════
-- MISSING INDEXES
-- ═══════════════════════════════════════

-- Messages: compound index for conversation + direction (used in triage and context assembly)
CREATE INDEX IF NOT EXISTS idx_messages_conv_direction
  ON messages(conversation_id, direction, sent_at DESC);

-- Messages: for AI cost tracking queries
CREATE INDEX IF NOT EXISTS idx_audit_log_ai_usage
  ON audit_log(entity_type, created_at DESC)
  WHERE entity_type = 'ai_usage';

-- Leads: compound for CRM pipeline view (stage + heat_score)
CREATE INDEX IF NOT EXISTS idx_leads_stage_heat
  ON leads(stage, heat_score DESC);

-- Leads: for Calendly matching by username
CREATE INDEX IF NOT EXISTS idx_leads_username
  ON leads(username);

-- Conversations: active conversations for a lead (used in process worker)
CREATE INDEX IF NOT EXISTS idx_conversations_lead_active
  ON conversations(lead_id, status, created_at DESC)
  WHERE status = 'active';

-- Notifications: unread broadcast notifications (user_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast_unread
  ON notifications(created_at DESC)
  WHERE user_id IS NULL AND read = FALSE;

-- AI Suggestions: recent suggestions per conversation
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_conv
  ON ai_suggestions(conversation_id, generated_at DESC);

-- Follow-up jobs: active jobs ordered by fire time
CREATE INDEX IF NOT EXISTS idx_follow_up_jobs_active
  ON follow_up_jobs(next_fire_at ASC)
  WHERE status = 'active';

-- ═══════════════════════════════════════
-- MATERIALIZED VIEW: Daily Metrics
-- Refresh every hour (via cron or manual)
-- ═══════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_metrics AS
SELECT
  d::date AS day,
  COALESCE(inbound.cnt, 0) AS inbound_dms,
  COALESCE(outbound.cnt, 0) AS outbound_dms,
  COALESCE(new_leads.cnt, 0) AS leads_created,
  COALESCE(booked.cnt, 0) AS calls_booked
FROM generate_series(
  CURRENT_DATE - INTERVAL '90 days',
  CURRENT_DATE,
  '1 day'
) AS d
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
  FROM messages
  WHERE direction = 'inbound'
    AND sent_at::date = d::date
) inbound ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
  FROM messages
  WHERE direction = 'outbound'
    AND sent_at::date = d::date
) outbound ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
  FROM leads
  WHERE created_at::date = d::date
) new_leads ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS cnt
  FROM leads
  WHERE calendly_booked_at::date = d::date
) booked ON TRUE
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_metrics_day ON mv_daily_metrics(day);

-- ═══════════════════════════════════════
-- MATERIALIZED VIEW: Lead Stats
-- Refresh every 15 minutes (via cron)
-- ═══════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_lead_stats AS
SELECT
  stage,
  assignment_type,
  COUNT(*) AS lead_count,
  AVG(heat_score) AS avg_heat_score,
  COUNT(*) FILTER (WHERE calendly_booked_at IS NOT NULL) AS booked_count,
  COUNT(*) FILTER (WHERE last_message_at > NOW() - INTERVAL '24 hours') AS active_24h
FROM leads
GROUP BY stage, assignment_type
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_lead_stats_stage_type
  ON mv_lead_stats(stage, assignment_type);

-- ═══════════════════════════════════════
-- REFRESH FUNCTIONS (call from cron)
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION refresh_daily_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_metrics;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_lead_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_lead_stats;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════
-- QUERY TIMEOUT (5 second max for all queries)
-- ═══════════════════════════════════════

ALTER DATABASE postgres SET statement_timeout = '5000';
