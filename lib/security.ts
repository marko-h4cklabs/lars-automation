/**
 * Security utilities: env validation, input sanitization, audit logging.
 */

import { createAdminClient } from '@/lib/supabase'

// ═══════════════════════════════════════
// ENV VALIDATION
// ═══════════════════════════════════════

interface EnvRequirement {
  key: string
  required: boolean
  description: string
}

const ENV_REQUIREMENTS: EnvRequirement[] = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', required: true, description: 'Supabase project URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, description: 'Supabase anon key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase service role key' },
  { key: 'ANTHROPIC_API_KEY', required: true, description: 'Claude API key' },
  { key: 'OPENAI_API_KEY', required: false, description: 'OpenAI API key (Whisper transcription)' },
  { key: 'ELEVENLABS_API_KEY', required: false, description: 'ElevenLabs API key (voice synthesis)' },
  { key: 'UPSTASH_REDIS_REST_URL', required: true, description: 'Upstash Redis URL' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', required: true, description: 'Upstash Redis token' },
  { key: 'QSTASH_TOKEN', required: true, description: 'QStash token' },
  { key: 'MANYCHAT_API_KEY', required: true, description: 'ManyChat API key' },
  { key: 'SLACK_WEBHOOK_ALERTS', required: false, description: 'Slack alerts webhook URL' },
  { key: 'NEXT_PUBLIC_APP_URL', required: true, description: 'Application URL' },
]

/**
 * Validate all required environment variables are present.
 * Call during app initialization (e.g., in instrumentation.ts or first API call).
 */
export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = []
  const warnings: string[] = []

  for (const req of ENV_REQUIREMENTS) {
    if (!process.env[req.key]) {
      if (req.required) {
        missing.push(`${req.key} — ${req.description}`)
      } else {
        warnings.push(`${req.key} — ${req.description} (optional)`)
      }
    }
  }

  if (missing.length > 0) {
    console.error('=== MISSING REQUIRED ENV VARS ===')
    missing.forEach((m) => console.error(`  ✗ ${m}`))
  }
  if (warnings.length > 0) {
    console.warn('=== MISSING OPTIONAL ENV VARS ===')
    warnings.forEach((w) => console.warn(`  ⚠ ${w}`))
  }

  return { valid: missing.length === 0, missing, warnings }
}

// ═══════════════════════════════════════
// INPUT SANITIZATION
// ═══════════════════════════════════════

/**
 * Sanitize a string to prevent XSS.
 * Escapes HTML entities and removes control characters.
 */
export function sanitize(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Remove null bytes and control characters (except newlines/tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Sanitize for database text fields (less aggressive — preserves quotes).
 * Only removes null bytes and control characters.
 */
export function sanitizeDB(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Validate and sanitize an email address.
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(trimmed) ? trimmed : null
}

/**
 * Validate a webhook URL (must be HTTPS).
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// ═══════════════════════════════════════
// AUDIT LOGGING
// ═══════════════════════════════════════

/**
 * Log a destructive or sensitive action to audit_log.
 * Fire-and-forget — never blocks the main flow.
 */
export function auditLog(
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>
): void {
  Promise.resolve(
    createAdminClient()
      .from('audit_log')
      .insert({
        actor,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata: metadata || {},
      })
  ).catch(() => {})
}

// ═══════════════════════════════════════
// MANYCHAT IP ALLOWLIST
// ═══════════════════════════════════════

// ManyChat webhook IPs (update if ManyChat publishes new ranges)
const MANYCHAT_IP_RANGES = [
  '3.221.',    // AWS us-east-1
  '34.193.',
  '52.55.',
  '54.156.',
  '54.88.',
]

/**
 * Check if the request IP is from ManyChat's known IP ranges.
 * Returns true if IP matches or if allowlist check is disabled.
 */
export function isManyChat(ip: string | null): boolean {
  if (!ip) return false
  // In development, skip IP check
  if (process.env.NODE_ENV === 'development') return true
  return MANYCHAT_IP_RANGES.some((prefix) => ip.startsWith(prefix))
}
