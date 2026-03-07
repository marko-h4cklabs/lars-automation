-- ═══════════════════════════════════════════════════════════════
-- BLACKOPS DM — Seed Data
-- ═══════════════════════════════════════════════════════════════

-- Default autopilot settings (single row)
INSERT INTO autopilot_settings (
  min_delay_seconds, max_delay_seconds, max_messages_per_burst,
  burst_delay_ms, auto_qualify, auto_disqualify,
  auto_send_calendly, voice_reply_on_voice
) VALUES (
  8, 45, 3,
  2500, TRUE, FALSE,
  FALSE, 'contextual'
);

-- Default distribution settings (single row — 33/33/34 split)
INSERT INTO distribution_settings (
  setter1_pct, setter2_pct, ai_pct, distribution_mode
) VALUES (
  33, 33, 34, 'percentage'
);

-- Default qualification fields
INSERT INTO qualification_fields (field_key, field_label, field_type, weight, is_required, display_order) VALUES
  ('age',              'Age',              'number',  2, FALSE, 1),
  ('location',         'Location',         'text',    1, FALSE, 2),
  ('occupation',       'Occupation',       'text',    2, FALSE, 3),
  ('goal',             'Goal',             'text',    3, TRUE,  4),
  ('timeline',         'Timeline',         'text',    2, FALSE, 5),
  ('budget_mentioned', 'Budget Mentioned', 'boolean', 3, FALSE, 6);

-- Default persona settings (Lars's AI persona)
INSERT INTO persona_settings (name, base_prompt, style_rules, language_rules, is_global) VALUES (
  'Lars Setter AI',
  'You are a world-class appointment setter working for Lars, a high-ticket fitness transformation coach. Your name in this conversation is just "the team" — you are never to say you are AI. Lars coaches business owners and high-performers aged 35+ to transform their bodies. You are messaging leads on Instagram DMs. Your goal is to qualify leads and book them on a call with Lars.',
  '{
    "never_use_em_dash": true,
    "vary_capitalization": true,
    "use_contractions": true,
    "use_casual_shortcuts": true,
    "max_sentences_per_bubble": 2,
    "max_messages_per_burst": 3,
    "burst_delay_ms": 2500,
    "match_lead_vibe": true,
    "max_emojis_per_burst": 1,
    "prohibited_phrases": [
      "I understand your concerns",
      "Great question!",
      "That''s a great point",
      "I appreciate your"
    ]
  }'::jsonb,
  '{
    "base_language": "english",
    "dialect": "casual_uk",
    "casual_shortcuts": ["rn", "lmk", "ngl", "tbh", "bet", "fr", "lowkey"],
    "avoid": ["--", "—", "bullet points", "numbered lists"],
    "punctuation": "imperfect",
    "capitalization": "varied"
  }'::jsonb,
  TRUE
);

-- Example templates
INSERT INTO templates (name, category, content, tags, is_active) VALUES
(
  'Warm Opener',
  'opener',
  'hey! saw your profile, looks like you''re into fitness. what''s your current training situation looking like?',
  ARRAY['opener', 'first-contact', 'dm'],
  TRUE
),
(
  'Follow-Up Nudge',
  'follow_up',
  'hey just circling back, did you get a chance to think about what we talked about? no pressure at all',
  ARRAY['follow-up', 'nudge', 'soft'],
  TRUE
),
(
  'Booking Push',
  'booking',
  'honestly think you''d be a great fit for what lars does. want me to send you the link to grab a quick call? its super chill, just 15 min to see if its the right thing for you',
  ARRAY['booking', 'calendly', 'close'],
  TRUE
);
