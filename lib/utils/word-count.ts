/**
 * Counts the number of words in a given text string.
 * Uses a consistent logic across the application:
 * 1. Handles null/undefined (returns 0)
 * 2. Trims whitespace
 * 3. Splits by any whitespace character
 * 4. Returns 0 for empty strings
 */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}
