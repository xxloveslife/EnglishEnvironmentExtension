/**
 * FNV-1a Hash Algorithm Implementation
 *
 * Fast, simple hash function with low collision rate
 * Used for generating cache keys and node fingerprints
 */

/**
 * FNV-1a 32-bit hash algorithm
 * Returns 8-character hexadecimal string
 *
 * @param text - Input text to hash
 * @returns 8-digit hex hash string
 *
 * @example
 * hashText("测试文本") // "a3b4c5d6"
 */
export function hashText(text: string): string {
  const FNV_PRIME = 0x01000193
  const FNV_OFFSET_BASIS = 0x811c9dc5

  let hash = FNV_OFFSET_BASIS

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }

  // Convert to unsigned 32-bit integer and format as 8-digit hex
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Generate cache key from text hash and user level
 *
 * @param textHash - Hash of normalized text (from hashText)
 * @param userLevel - User proficiency level (A1-C2)
 * @returns Cache key string
 *
 * @example
 * generateCacheKey("a3b4c5d6", "A1") // "a3b4c5d6:A1"
 */
export function generateCacheKey(textHash: string, userLevel: string): string {
  return `${textHash}:${userLevel}`
}

/**
 * Generate node fingerprint for WeakMap tracking
 *
 * @param textHash - Hash of normalized text
 * @param userLevel - User proficiency level (A1-C2)
 * @param mode - Processing mode ('original' or 'translated')
 * @returns Node fingerprint string
 *
 * @example
 * generateNodeFingerprint("a3b4c5d6", "A1", "original") // "a3b4c5d6:A1:original"
 */
export function generateNodeFingerprint(
  textHash: string,
  userLevel: string,
  mode: 'original' | 'translated'
): string {
  return `${textHash}:${userLevel}:${mode}`
}

/**
 * Batch hash multiple texts
 * Optimized for processing large arrays of text nodes
 *
 * @param texts - Array of text strings to hash
 * @returns Map of text to hash
 *
 * @example
 * const map = batchHash(["文本1", "文本2"])
 * map.get("文本1") // "a3b4c5d6"
 */
export function batchHash(texts: string[]): Map<string, string> {
  const result = new Map<string, string>()

  for (const text of texts) {
    if (!result.has(text)) {
      result.set(text, hashText(text))
    }
  }

  return result
}

/**
 * Hash utilities for performance-critical operations
 */
export const HashUtils = {
  hashText,
  generateCacheKey,
  generateNodeFingerprint,
  batchHash
}
