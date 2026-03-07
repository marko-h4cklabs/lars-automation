-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 003: Analytics RPC Functions
-- ═══════════════════════════════════════════════════════════════

-- ─── get_daily_metrics ───────────────────────────────────────
-- Returns daily aggregated counts for DMs, leads, and bookings.
CREATE OR REPLACE FUNCTION get_daily_metrics(
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ
)
RETURNS TABLE (
  day DATE,
  inbound_dms BIGINT,
  outbound_dms BIGINT,
  leads_created BIGINT,
  calls_booked BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT d::date AS day
    FROM generate_series(date_from::date, date_to::date, '1 day'::interval) d
  ),
  msg_in AS (
    SELECT sent_at::date AS d, COUNT(*) AS cnt
    FROM messages
    WHERE direction = 'inbound' AND sent_at >= date_from AND sent_at <= date_to
    GROUP BY 1
  ),
  msg_out AS (
    SELECT sent_at::date AS d, COUNT(*) AS cnt
    FROM messages
    WHERE direction = 'outbound' AND sent_at >= date_from AND sent_at <= date_to
    GROUP BY 1
  ),
  new_leads AS (
    SELECT created_at::date AS d, COUNT(*) AS cnt
    FROM leads
    WHERE created_at >= date_from AND created_at <= date_to
    GROUP BY 1
  ),
  booked AS (
    SELECT calendly_booked_at::date AS d, COUNT(*) AS cnt
    FROM leads
    WHERE calendly_booked_at >= date_from AND calendly_booked_at <= date_to
    GROUP BY 1
  )
  SELECT
    days.day,
    COALESCE(mi.cnt, 0) AS inbound_dms,
    COALESCE(mo.cnt, 0) AS outbound_dms,
    COALESCE(nl.cnt, 0) AS leads_created,
    COALESCE(bk.cnt, 0) AS calls_booked
  FROM days
  LEFT JOIN msg_in mi ON mi.d = days.day
  LEFT JOIN msg_out mo ON mo.d = days.day
  LEFT JOIN new_leads nl ON nl.d = days.day
  LEFT JOIN booked bk ON bk.d = days.day
  ORDER BY days.day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── get_setter_performance ──────────────────────────────────
-- Returns per-actor performance metrics (setters + AI).
CREATE OR REPLACE FUNCTION get_setter_performance(
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ
)
RETURNS TABLE (
  actor_id TEXT,
  actor_name TEXT,
  actor_type TEXT,
  leads_assigned BIGINT,
  leads_replied BIGINT,
  leads_qualified BIGINT,
  leads_booked BIGINT,
  avg_response_seconds DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  WITH actors AS (
    -- Human setters
    SELECT
      u.id::text AS aid,
      u.name AS aname,
      'setter' AS atype
    FROM users u
    WHERE u.role = 'setter'
    UNION ALL
    -- AI agent
    SELECT 'ai', 'AI Agent', 'ai'
  ),
  lead_counts AS (
    SELECT
      CASE WHEN l.assignment_type = 'ai' THEN 'ai' ELSE l.assigned_to::text END AS aid,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE l.stage IN ('qualifying','call_offered','call_booked','showed','no_show','won','lost')) AS qualified,
      COUNT(*) FILTER (WHERE l.stage IN ('call_booked','showed','no_show','won')) AS booked
    FROM leads l
    WHERE l.created_at >= date_from AND l.created_at <= date_to
    GROUP BY 1
  ),
  reply_counts AS (
    SELECT
      CASE WHEN m.sent_by = 'ai' THEN 'ai' ELSE m.sent_by END AS aid,
      COUNT(DISTINCT m.lead_id) AS replied
    FROM messages m
    WHERE m.direction = 'outbound'
      AND m.sent_at >= date_from AND m.sent_at <= date_to
      AND m.sent_by IS NOT NULL
      AND m.sent_by NOT IN ('system', 'lead')
    GROUP BY 1
  ),
  response_times AS (
    SELECT
      CASE WHEN m_out.sent_by = 'ai' THEN 'ai' ELSE m_out.sent_by END AS aid,
      AVG(EXTRACT(EPOCH FROM (m_out.sent_at - m_in.sent_at))) AS avg_secs
    FROM messages m_in
    JOIN LATERAL (
      SELECT m2.sent_by, m2.sent_at
      FROM messages m2
      WHERE m2.conversation_id = m_in.conversation_id
        AND m2.direction = 'outbound'
        AND m2.sent_at > m_in.sent_at
        AND m2.sent_by IS NOT NULL
        AND m2.sent_by NOT IN ('system', 'lead')
      ORDER BY m2.sent_at ASC
      LIMIT 1
    ) m_out ON TRUE
    WHERE m_in.direction = 'inbound'
      AND m_in.sent_at >= date_from AND m_in.sent_at <= date_to
    GROUP BY 1
  )
  SELECT
    a.aid AS actor_id,
    a.aname AS actor_name,
    a.atype AS actor_type,
    COALESCE(lc.total, 0) AS leads_assigned,
    COALESCE(rc.replied, 0) AS leads_replied,
    COALESCE(lc.qualified, 0) AS leads_qualified,
    COALESCE(lc.booked, 0) AS leads_booked,
    COALESCE(rt.avg_secs, 0) AS avg_response_seconds
  FROM actors a
  LEFT JOIN lead_counts lc ON lc.aid = a.aid
  LEFT JOIN reply_counts rc ON rc.aid = a.aid
  LEFT JOIN response_times rt ON rt.aid = a.aid
  ORDER BY COALESCE(lc.booked, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── get_funnel_stats ────────────────────────────────────────
-- Returns conversion funnel counts for leads created in period.
CREATE OR REPLACE FUNCTION get_funnel_stats(
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ
)
RETURNS TABLE (
  total_dms BIGINT,
  replied BIGINT,
  qualifying BIGINT,
  call_offered BIGINT,
  booked BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH period_leads AS (
    SELECT l.id, l.stage
    FROM leads l
    WHERE l.created_at >= date_from AND l.created_at <= date_to
  )
  SELECT
    (SELECT COUNT(*) FROM period_leads) AS total_dms,
    (SELECT COUNT(*) FROM period_leads WHERE stage NOT IN ('new')) AS replied,
    (SELECT COUNT(*) FROM period_leads WHERE stage IN ('qualifying','call_offered','call_booked','showed','no_show','won','lost')) AS qualifying,
    (SELECT COUNT(*) FROM period_leads WHERE stage IN ('call_offered','call_booked','showed','no_show','won')) AS call_offered,
    (SELECT COUNT(*) FROM period_leads WHERE stage IN ('call_booked','showed','no_show','won')) AS booked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
