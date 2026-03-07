import type { NormalizedPayload, LeadSource } from '@/types'

interface RawManyChatBody {
  source?: string
  keyword?: string | null
  instagram_user_id?: string
  username?: string
  full_name?: string
  bio?: string
  follower_count?: number
  profile_pic_url?: string
  message_text?: string
  message_type?: 'text' | 'voice' | 'image'
  voice_url?: string | null
  timestamp?: string
  // Allow extra fields
  [key: string]: unknown
}

/**
 * Normalizes a raw ManyChat webhook body into our internal payload format.
 * Throws if required fields are missing.
 */
export function normalizePayload(
  raw: RawManyChatBody,
  defaultSource: LeadSource
): NormalizedPayload {
  const instagramUserId = raw.instagram_user_id
  const username = raw.username

  if (!instagramUserId || !username) {
    throw new Error('Missing required fields: instagram_user_id, username')
  }

  return {
    source: (raw.source as LeadSource) || defaultSource,
    keyword: raw.keyword || null,
    instagramUserId,
    username,
    fullName: raw.full_name || username,
    bio: raw.bio || '',
    followerCount: raw.follower_count || 0,
    profilePicUrl: raw.profile_pic_url || '',
    messageText: raw.message_text || '',
    messageType: raw.message_type || 'text',
    voiceUrl: raw.voice_url || null,
    timestamp: raw.timestamp || new Date().toISOString(),
    rawPayload: raw as Record<string, unknown>,
  }
}
