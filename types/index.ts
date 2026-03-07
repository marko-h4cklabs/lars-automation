// ═══════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════

export enum UserRole {
  Admin = 'admin',
  Setter = 'setter',
  Viewer = 'viewer',
}

export enum UserStatus {
  Online = 'online',
  Offline = 'offline',
  Away = 'away',
}

export enum LeadSource {
  DM = 'dm',
  StoryReply = 'story_reply',
  Comment = 'comment',
  Follow = 'follow',
  Keyword = 'keyword',
}

export enum LeadStage {
  New = 'new',
  Contacted = 'contacted',
  Qualifying = 'qualifying',
  CallOffered = 'call_offered',
  CallBooked = 'call_booked',
  Showed = 'showed',
  NoShow = 'no_show',
  Won = 'won',
  Lost = 'lost',
  Disqualified = 'disqualified',
}

export enum AssignmentType {
  Setter1 = 'setter1',
  Setter2 = 'setter2',
  AI = 'ai',
}

export enum ConversationStatus {
  Active = 'active',
  Closed = 'closed',
  Paused = 'paused',
}

export enum MessageDirection {
  Inbound = 'inbound',
  Outbound = 'outbound',
}

export enum MessageType {
  Text = 'text',
  Voice = 'voice',
  Image = 'image',
  Template = 'template',
  AIGenerated = 'ai_generated',
}

export enum KeywordMatchType {
  Exact = 'exact',
  Contains = 'contains',
  StartsWith = 'starts_with',
  Regex = 'regex',
}

export enum KBDocumentType {
  Offer = 'offer',
  Script = 'script',
  Persona = 'persona',
  Training = 'training',
  General = 'general',
}

export enum QualificationFieldType {
  Text = 'text',
  Number = 'number',
  Boolean = 'boolean',
  Select = 'select',
}

export enum VoiceReplyMode {
  Always = 'always',
  Never = 'never',
  Contextual = 'contextual',
}

export enum DistributionMode {
  Percentage = 'percentage',
  RoundRobin = 'round_robin',
  LoadBased = 'load_based',
}

export enum NotificationType {
  HotLead = 'hot_lead',
  CallBooked = 'call_booked',
  Disqualified = 'disqualified',
  SetterOffline = 'setter_offline',
  AITakeover = 'ai_takeover',
}

export enum FollowUpJobStatus {
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum TrainingOutcome {
  Success = 'success',
  Failure = 'failure',
  Partial = 'partial',
}

// ═══════════════════════════════════════
// DATABASE ENTITY INTERFACES
// ═══════════════════════════════════════

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  telegram_chat_id: string | null
  status: UserStatus
  avatar_url: string | null
  last_seen: string | null
  created_at: string
}

export interface Lead {
  id: string
  instagram_user_id: string
  username: string
  full_name: string | null
  bio: string | null
  follower_count: number | null
  profile_pic_url: string | null
  source: LeadSource
  assigned_to: string | null // user_id or null (if AI)
  assignment_type: AssignmentType
  stage: LeadStage
  heat_score: number // 0-100
  qualification_fields: Record<string, unknown>
  calendly_booked_at: string | null
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  lead_id: string
  status: ConversationStatus
  summary: string | null
  summary_updated_at: string | null
  qualified_fields_collected: Record<string, unknown>
  qualification_score: number
  assigned_to: string | null // user_id or null (if AI)
  follow_up_sequence_id: string | null
  created_at: string
  updated_at: string
  // Joined fields (optional, populated by queries)
  lead?: Lead
  messages?: Message[]
  unread_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  lead_id: string
  direction: MessageDirection
  type: MessageType
  content: string
  voice_url: string | null
  manychat_message_id: string | null
  sent_by: string | null // user_id, 'ai', or 'system'
  sent_at: string
  delivered_at: string | null
  read_at: string | null
  ai_generated: boolean
  template_id: string | null
  bundle_id: string | null
}

export interface AISuggestion {
  id: string
  conversation_id: string
  suggestion_1: string
  suggestion_2: string
  reasoning: string
  confidence_score: number
  context_snapshot: Record<string, unknown>
  used: boolean
  used_suggestion: number | null
  generated_at: string
}

export interface Template {
  id: string
  name: string
  category: string
  content: string
  tags: string[]
  is_active: boolean
  created_by: string
  created_at: string
}

export interface FollowUpSequence {
  id: string
  name: string
  is_active: boolean
  steps: FollowUpStep[]
  created_at: string
}

export interface FollowUpStep {
  delay_hours: number
  message_type: 'text' | 'ai_personalized' | 'template'
  content: string
  ai_personalized: boolean
}

export interface FollowUpJob {
  id: string
  lead_id: string
  conversation_id: string
  sequence_id: string
  current_step: number
  next_fire_at: string
  status: FollowUpJobStatus
  created_at: string
}

export interface KeywordTrigger {
  id: string
  keyword: string
  match_type: KeywordMatchType
  source: LeadSource | 'any'
  response_template: string
  webhook_endpoint: string | null
  is_active: boolean
  created_at: string
}

export interface KBDocument {
  id: string
  title: string
  content: string
  type: KBDocumentType
  file_url: string | null
  file_type: string | null
  embedding: number[] | null
  is_active: boolean
  created_at: string
}

export interface QualificationField {
  id: string
  field_key: string
  field_label: string
  field_type: QualificationFieldType
  options: Record<string, unknown> | null
  weight: number
  is_required: boolean
  display_order: number
}

export interface PersonaSettings {
  id: string
  name: string
  base_prompt: string
  style_rules: StyleRules
  language_rules: Record<string, unknown>
  is_global: boolean
  created_at: string
}

export interface StyleRules {
  never_use_em_dash: boolean
  vary_capitalization: boolean
  use_contractions: boolean
  use_casual_shortcuts: boolean
  max_sentences_per_bubble: number
  max_messages_per_burst: number
  burst_delay_ms: number
  match_lead_vibe: boolean
  max_emojis_per_burst: number
  prohibited_phrases: string[]
}

export interface SetterAISettings {
  id: string
  user_id: string
  response_style: string
  custom_prompt_additions: string
  suggestions_count: number
  auto_score_leads: boolean
  updated_at: string
}

export interface AutopilotSettings {
  id: string
  min_delay_seconds: number
  max_delay_seconds: number
  max_messages_per_burst: number
  burst_delay_ms: number
  auto_qualify: boolean
  auto_disqualify: boolean
  auto_send_calendly: boolean
  voice_reply_on_voice: VoiceReplyMode
  updated_at: string
}

export interface DistributionSettings {
  id: string
  setter1_id: string | null
  setter2_id: string | null
  setter1_pct: number
  setter2_pct: number
  ai_pct: number
  distribution_mode: DistributionMode
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string | null
  type: NotificationType
  lead_id: string | null
  conversation_id: string | null
  message: string
  read: boolean
  telegram_sent: boolean
  created_at: string
}

export interface TrainingConversation {
  id: string
  title: string
  conversation_data: Record<string, unknown>
  outcome: TrainingOutcome
  feedback_notes: string | null
  approved: boolean
  approved_by: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  actor: string // user_id, 'ai', or 'system'
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

// ═══════════════════════════════════════
// WEBHOOK / API TYPES
// ═══════════════════════════════════════

export interface ManyChatWebhookPayload {
  source: LeadSource
  keyword: string | null
  instagram_user_id: string
  username: string
  full_name: string
  bio: string
  follower_count: number
  profile_pic_url: string
  message_text: string
  message_type: 'text' | 'voice' | 'image'
  voice_url: string | null
  timestamp: string
}

export interface NormalizedPayload {
  source: LeadSource
  keyword: string | null
  instagramUserId: string
  username: string
  fullName: string
  bio: string
  followerCount: number
  profilePicUrl: string
  messageText: string
  messageType: 'text' | 'voice' | 'image'
  voiceUrl: string | null
  timestamp: string
  rawPayload: Record<string, unknown>
}

export interface AITriageResult {
  heat_score: number
  urgency: 'low' | 'medium' | 'high'
  qualification_hints: string[]
  suggested_stage: LeadStage
}

export interface AIAutopilotResponse {
  messages: string[]
  reasoning: string
  should_send_calendly: boolean
  qualification_updates: Record<string, unknown>
  updated_heat_score: number
  next_action: 'continue_qualifying' | 'book_call' | 'soft_close'
}

export interface AISuggestionResponse {
  option_a: {
    messages: string[]
    confidence: number
    reasoning: string
    targeting_field: string
  }
  option_b: {
    messages: string[]
    confidence: number
    reasoning: string
    targeting_field: string
  }
  context_summary: string
  recommended: 'a' | 'b'
}

export interface LiveMetrics {
  activeLeads: number
  queuedMessages: number
  onlineSetters: number
  totalSetters: number
  aiActive: boolean
  todayBooked: number
  todayNewLeads: number
}
