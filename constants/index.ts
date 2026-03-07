import { LeadStage, LeadSource, MessageType, NotificationType } from '@/types'
import type { StyleRules } from '@/types'

// ═══════════════════════════════════════
// STAGE & TYPE ARRAYS
// ═══════════════════════════════════════

export const LEAD_STAGES: { value: LeadStage; label: string }[] = [
  { value: LeadStage.New, label: 'New' },
  { value: LeadStage.Contacted, label: 'Contacted' },
  { value: LeadStage.Qualifying, label: 'Qualifying' },
  { value: LeadStage.CallOffered, label: 'Call Offered' },
  { value: LeadStage.CallBooked, label: 'Call Booked' },
  { value: LeadStage.Showed, label: 'Showed' },
  { value: LeadStage.NoShow, label: 'No Show' },
  { value: LeadStage.Won, label: 'Won' },
  { value: LeadStage.Lost, label: 'Lost' },
  { value: LeadStage.Disqualified, label: 'Disqualified' },
]

export const MESSAGE_TYPES: { value: MessageType; label: string }[] = [
  { value: MessageType.Text, label: 'Text' },
  { value: MessageType.Voice, label: 'Voice' },
  { value: MessageType.Image, label: 'Image' },
  { value: MessageType.Template, label: 'Template' },
  { value: MessageType.AIGenerated, label: 'AI Generated' },
]

export const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: NotificationType.HotLead, label: 'Hot Lead Alert' },
  { value: NotificationType.CallBooked, label: 'Call Booked' },
  { value: NotificationType.AITakeover, label: 'AI Takeover' },
  { value: NotificationType.SetterOffline, label: 'Setter Went Offline' },
  { value: NotificationType.Disqualified, label: 'Disqualified' },
]

export const SOURCE_TYPES: { value: LeadSource; label: string }[] = [
  { value: LeadSource.DM, label: 'DM' },
  { value: LeadSource.StoryReply, label: 'Story Reply' },
  { value: LeadSource.Comment, label: 'Comment' },
  { value: LeadSource.Follow, label: 'Follow' },
  { value: LeadSource.Keyword, label: 'Keyword' },
]

// ═══════════════════════════════════════
// DEFAULT PERSONA STYLE RULES
// ═══════════════════════════════════════

export const DEFAULT_STYLE_RULES: StyleRules = {
  never_use_em_dash: true,
  vary_capitalization: true,
  use_contractions: true,
  use_casual_shortcuts: true,
  max_sentences_per_bubble: 2,
  max_messages_per_burst: 3,
  burst_delay_ms: 2500,
  match_lead_vibe: true,
  max_emojis_per_burst: 1,
  prohibited_phrases: [
    'I understand your concerns',
    'Great question!',
    'That\'s a great point',
    'I appreciate your',
  ],
}

// ═══════════════════════════════════════
// TIMING DEFAULTS
// ═══════════════════════════════════════

export const MAX_BURST_MESSAGES = 3
export const DEFAULT_MIN_DELAY_SECONDS = 8
export const DEFAULT_MAX_DELAY_SECONDS = 45
export const DEFAULT_BURST_DELAY_MS = 2500
export const MESSAGE_BUNDLE_WINDOW_SECONDS = 30
export const MESSAGE_BUNDLE_EXTEND_SECONDS = 15

// ═══════════════════════════════════════
// SCORING
// ═══════════════════════════════════════

export const HOT_LEAD_THRESHOLD = 80
export const DEFAULT_QUALIFICATION_FIELDS = [
  'age',
  'location',
  'occupation',
  'goal',
  'timeline',
  'budget_mentioned',
]

// ═══════════════════════════════════════
// UI
// ═══════════════════════════════════════

export const CONVERSATIONS_PER_PAGE = 20
export const MESSAGES_PER_PAGE = 50
export const SUMMARY_UPDATE_INTERVAL = 5 // every N inbound messages
export const LIVE_METRICS_POLL_INTERVAL = 30000 // 30 seconds
