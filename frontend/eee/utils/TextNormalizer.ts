/**
 * Text Normalization Utilities
 *
 * Normalizes text to improve cache hit rate and reduce API calls
 * Handles whitespace, zero-width characters, and formatting variations
 */

/**
 * Normalization configuration options
 */
export interface NormalizeConfig {
  /** Remove leading and trailing whitespace (default: true) */
  trim: boolean
  /** Collapse consecutive whitespace into single space (default: true) */
  collapseWhitespace: boolean
  /** Remove zero-width characters (default: true) */
  removeZeroWidth: boolean
  /** Convert full-width spaces to half-width (default: true) */
  convertFullWidth: boolean
  /** Remove line breaks (default: false, preserves structure) */
  removeLineBreaks: boolean
}

/**
 * Default normalization configuration
 */
const DEFAULT_CONFIG: NormalizeConfig = {
  trim: true,
  collapseWhitespace: true,
  removeZeroWidth: true,
  convertFullWidth: true,
  removeLineBreaks: false
}

/**
 * Zero-width characters regex
 * Includes: ZWSP, ZWNJ, ZWJ, ZWNBSP/BOM
 */
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g

/**
 * Full-width space character (U+3000)
 */
const FULL_WIDTH_SPACE = '\u3000'

/**
 * Normalize text for consistent caching and comparison
 *
 * @param text - Input text to normalize
 * @param config - Optional configuration (uses defaults if not provided)
 * @returns Normalized text
 *
 * @example
 * normalizeText("  测试  ")  // "测试"
 * normalizeText("测\u200B试")  // "测试" (removes zero-width space)
 * normalizeText("测　试")  // "测 试" (full-width to half-width)
 * normalizeText("测\n\n试", { removeLineBreaks: true })  // "测 试"
 */
export function normalizeText(
  text: string,
  config: Partial<NormalizeConfig> = {}
): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  let normalized = text

  // Step 1: Remove zero-width characters
  if (finalConfig.removeZeroWidth) {
    normalized = normalized.replace(ZERO_WIDTH_REGEX, '')
  }

  // Step 2: Convert full-width spaces to half-width
  if (finalConfig.convertFullWidth) {
    normalized = normalized.replace(new RegExp(FULL_WIDTH_SPACE, 'g'), ' ')
  }

  // Step 3: Remove line breaks (optional)
  if (finalConfig.removeLineBreaks) {
    normalized = normalized.replace(/[\r\n]+/g, ' ')
  }

  // Step 4: Collapse consecutive whitespace
  if (finalConfig.collapseWhitespace) {
    normalized = normalized.replace(/\s+/g, ' ')
  }

  // Step 5: Trim leading/trailing whitespace
  if (finalConfig.trim) {
    normalized = normalized.trim()
  }

  return normalized
}

/**
 * Check if text would be affected by normalization
 * Useful for performance optimization - skip normalization if not needed
 *
 * @param text - Input text to check
 * @returns true if normalization would change the text
 *
 * @example
 * needsNormalization("测试")  // false
 * needsNormalization("  测试  ")  // true
 * needsNormalization("测\u200B试")  // true
 */
export function needsNormalization(text: string): boolean {
  // Check leading/trailing whitespace
  if (text !== text.trim()) {
    return true
  }

  // Check zero-width characters
  if (ZERO_WIDTH_REGEX.test(text)) {
    return true
  }

  // Check full-width spaces
  if (text.includes(FULL_WIDTH_SPACE)) {
    return true
  }

  // Check consecutive whitespace
  if (/\s{2,}/.test(text)) {
    return true
  }

  // Check line breaks
  if (/[\r\n]/.test(text)) {
    return true
  }

  return false
}

/**
 * Batch normalize multiple texts
 * Optimized for processing arrays of text nodes
 *
 * @param texts - Array of texts to normalize
 * @param config - Optional configuration
 * @returns Array of normalized texts (same order)
 *
 * @example
 * batchNormalize(["  text1  ", "text2\u200B"])  // ["text1", "text2"]
 */
export function batchNormalize(
  texts: string[],
  config: Partial<NormalizeConfig> = {}
): string[] {
  return texts.map(text => normalizeText(text, config))
}

/**
 * Get normalization statistics for debugging
 *
 * @param texts - Array of texts to analyze
 * @returns Statistics object
 *
 * @example
 * getNormalizationStats(["  text1  ", "text2"])
 * // { total: 2, needsNormalization: 1, percentage: 50 }
 */
export function getNormalizationStats(texts: string[]): {
  total: number
  needsNormalization: number
  percentage: number
} {
  const total = texts.length
  const needsNorm = texts.filter(needsNormalization).length

  return {
    total,
    needsNormalization: needsNorm,
    percentage: total > 0 ? Math.round((needsNorm / total) * 100) : 0
  }
}

/**
 * Text normalization utilities
 */
export const TextNormalizer = {
  normalizeText,
  needsNormalization,
  batchNormalize,
  getNormalizationStats
}
