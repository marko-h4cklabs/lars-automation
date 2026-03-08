/**
 * Validates if a name looks like a real human name vs a username/handle.
 */
export function isRealisticName(name: string): boolean {
  if (!name || name.length < 2) return false
  // Contains numbers → NOT realistic (e.g. orangejuice99)
  if (/\d/.test(name)) return false
  // Has special characters (not letters, spaces, hyphens, apostrophes)
  if (/[^a-zA-ZÀ-ÿ\s\-']/.test(name)) return false
  // Is all lowercase with underscores → likely username
  if (/^[a-z_]+$/.test(name)) return false
  // Contains underscores
  if (name.includes('_')) return false
  // Very long single "word" with no spaces → likely username
  if (!name.includes(' ') && name.length > 20) return false
  // First letter should be capitalized for a real name
  const firstWord = name.split(/[\s.]/)[0]
  if (firstWord.length >= 2 && firstWord === firstWord.toLowerCase()) return false
  // Passes all checks
  return true
}

/**
 * Returns a cleaned display name or fallback.
 * Handles dots (first.last), extracts first name, validates.
 */
export function getDisplayName(name: string | null | undefined, fallback: string = 'man'): string {
  if (!name || name.trim().length === 0) return fallback

  let cleaned = name.trim()

  // Handle dots (e.g. john.smith → John)
  if (cleaned.includes('.') && !cleaned.includes(' ')) {
    cleaned = cleaned.split('.')[0]
  }

  if (isRealisticName(cleaned)) {
    return cleaned
  }

  // Try to extract first word and check
  const firstWord = cleaned.split(/[\s._\-]+/)[0]
  if (firstWord && isRealisticName(
    firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
  )) {
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
  }

  return fallback
}

/**
 * Gets the first name from a full name string, validated.
 */
export function getFirstName(name: string | null | undefined, fallback: string = 'man'): string {
  if (!name) return fallback
  const first = name.trim().split(/[\s]+/)[0]
  return getDisplayName(first, fallback)
}
