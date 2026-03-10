import type { StyleRules } from '@/types'

// The DB stores extra fields beyond the TypeScript interface.
// This helper safely accesses them.
function ext(rules: StyleRules): Record<string, unknown> {
  return rules as unknown as Record<string, unknown>
}

/**
 * Build a strong, directive style block from persona style_rules.
 * Used by both autopilot and simulation prompts.
 */
export function buildStyleBlock(rules: StyleRules): string {
  const lines: string[] = ['\nSTYLE RULES (MANDATORY — violating these is a critical error):']

  // Hard prohibitions
  if (rules.never_use_em_dash) {
    lines.push('- NEVER use dashes of any kind: no "-", no "--", no "—". This is STRICTLY PROHIBITED.')
  }
  if (ext(rules).no_bullet_points) {
    lines.push('- NEVER use bullet points, numbered lists, or any list formatting in messages.')
  }

  // Writing style
  if (rules.vary_capitalization) {
    lines.push('- Vary capitalization naturally — sometimes start with lowercase, like real texting.')
  }
  if (rules.use_contractions) {
    lines.push("- Always use contractions (don't, can't, won't — never write do not, cannot, will not).")
  }
  if (rules.use_casual_shortcuts) {
    lines.push('- Use casual shortcuts naturally: rn, lmk, ngl, bet, tbh, fr.')
  }
  if (ext(rules).imperfect_punctuation) {
    lines.push('- Use imperfect punctuation like real texting — occasional missing periods, no question marks on rhetorical questions.')
  }
  if (ext(rules).multi_message_bursts) {
    lines.push('- Split thoughts into 2-3 short separate messages instead of one long block.')
  }

  // Limits
  lines.push(`- MAXIMUM ${rules.max_sentences_per_bubble} sentence(s) per message bubble. NEVER exceed this.`)
  lines.push(`- MAXIMUM ${rules.max_messages_per_burst} messages per response burst.`)
  lines.push(`- MAXIMUM ${rules.max_emojis_per_burst} emojis across all messages in a response.`)

  // Vibe matching
  if (rules.match_lead_vibe) {
    lines.push("- MATCH the lead's energy and writing style exactly.")
  }
  if (ext(rules).vibe_length_matching) {
    lines.push("- MATCH the lead's message LENGTH: if they send 3 words, reply with 3-8 words. Short messages get short replies.")
  }
  if (ext(rules).vibe_pace_matching) {
    lines.push("- MATCH the lead's PACE: if they send quick short messages, respond with quick short messages, not paragraphs.")
  }
  if (ext(rules).vibe_formality_matching) {
    lines.push("- MATCH the lead's FORMALITY level: if they are casual/informal, be casual. If formal, be slightly more polished.")
  }
  if (ext(rules).vibe_emoji_mirroring) {
    lines.push("- MIRROR the lead's emoji usage: if they don't use emojis, you don't either. If they do, match their frequency.")
  }

  // Prohibited phrases
  if (rules.prohibited_phrases?.length) {
    lines.push(`- NEVER use these exact phrases: "${rules.prohibited_phrases.join('", "')}"`)
  }

  // Signature phrases
  const signatures = ext(rules).signature_phrases as string[] | undefined
  if (signatures?.length) {
    lines.push(`- Naturally incorporate these signature phrases when appropriate: ${signatures.join(', ')}`)
  }

  // Custom rules
  const customRules = ext(rules).custom_rules as string[] | undefined
  if (customRules?.length) {
    for (const rule of customRules) {
      lines.push(`- ${rule}`)
    }
  }

  return lines.join('\n')
}
