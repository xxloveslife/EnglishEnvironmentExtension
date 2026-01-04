/**
 * Node Fingerprint Store - WeakMap-based Node Tracking
 *
 * Uses WeakMap for automatic garbage collection when nodes are removed from DOM
 * Prevents duplicate processing of the same text node
 */

import { hashText, generateNodeFingerprint } from './HashUtils'
import { normalizeText } from './TextNormalizer'
import { logger } from './logger'

/**
 * Node fingerprint information
 * Stored in WeakMap for each processed text node
 */
export interface NodeFingerprintInfo {
  /** Unique fingerprint: textHash:userLevel:mode */
  fingerprint: string
  /** FNV-1a hash of normalized text */
  textHash: string
  /** User proficiency level (A1-C2) */
  userLevel: string
  /** Processing mode */
  mode: 'original' | 'translated'
  /** Timestamp when node was processed */
  timestamp: number
  /** Normalized text content */
  normalizedText: string
}

/**
 * Statistics for debugging and monitoring
 */
export interface FingerprintStats {
  /** Total nodes marked (approximate, WeakMap can't be counted directly) */
  totalMarked: number
  /** Cache hits (reused fingerprints) */
  cacheHits: number
  /** Cache misses (new fingerprints) */
  cacheMisses: number
  /** Hit rate percentage */
  hitRate: number
}

export class NodeFingerprintStore {
  /** WeakMap for automatic garbage collection */
  private fingerprintMap = new WeakMap<Text, NodeFingerprintInfo>()

  /** Statistics tracking (manual counting since WeakMap.size doesn't exist) */
  private stats: FingerprintStats = {
    totalMarked: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0
  }

  /**
   * Mark a text node as processed
   * Stores fingerprint info in WeakMap
   *
   * @param textNode - Text node to mark
   * @param userLevel - User proficiency level
   * @param mode - Processing mode ('original' or 'translated')
   *
   * @example
   * store.markAsProcessed(textNode, 'A1', 'translated')
   */
  markAsProcessed(
    textNode: Text,
    userLevel: string,
    mode: 'original' | 'translated'
  ): void {
    const rawText = textNode.textContent ?? ''
    const normalizedText = normalizeText(rawText)
    const textHash = hashText(normalizedText)
    const fingerprint = generateNodeFingerprint(textHash, userLevel, mode)

    const info: NodeFingerprintInfo = {
      fingerprint,
      textHash,
      userLevel,
      mode,
      timestamp: Date.now(),
      normalizedText
    }

    this.fingerprintMap.set(textNode, info)
    this.stats.totalMarked++

    logger.debug(`Node marked as processed: ${fingerprint.substring(0, 16)}...`)
  }

  /**
   * Check if a text node has been processed
   * Compares current text content with stored fingerprint
   *
   * @param textNode - Text node to check
   * @param userLevel - User proficiency level
   * @param mode - Processing mode
   * @returns true if node has been processed with same content
   *
   * @example
   * if (!store.isProcessed(textNode, 'A1', 'original')) {
   *   // Process the node
   * }
   */
  isProcessed(
    textNode: Text,
    userLevel: string,
    mode: 'original' | 'translated'
  ): boolean {
    const stored = this.fingerprintMap.get(textNode)

    if (!stored) {
      this.stats.cacheMisses++
      return false
    }

    // Generate current fingerprint
    const rawText = textNode.textContent ?? ''
    const normalizedText = normalizeText(rawText)
    const textHash = hashText(normalizedText)
    const currentFingerprint = generateNodeFingerprint(textHash, userLevel, mode)

    // Compare fingerprints
    if (stored.fingerprint === currentFingerprint) {
      this.stats.cacheHits++
      logger.debug(`Node fingerprint matched: ${currentFingerprint.substring(0, 16)}...`)
      return true
    }

    // Content changed, fingerprint mismatch
    this.stats.cacheMisses++
    logger.debug(`Node fingerprint mismatch: stored=${stored.fingerprint.substring(0, 16)}..., current=${currentFingerprint.substring(0, 16)}...`)
    return false
  }

  /**
   * Get fingerprint info for a text node
   *
   * @param textNode - Text node to query
   * @returns Fingerprint info or null if not found
   */
  getInfo(textNode: Text): NodeFingerprintInfo | null {
    return this.fingerprintMap.get(textNode) ?? null
  }

  /**
   * Check if node exists in store (without fingerprint comparison)
   *
   * @param textNode - Text node to check
   * @returns true if node has been marked (regardless of current content)
   */
  has(textNode: Text): boolean {
    return this.fingerprintMap.has(textNode)
  }

  /**
   * Filter out processed nodes from an array
   * Returns only unprocessed nodes
   *
   * @param textNodes - Array of text nodes
   * @param userLevel - User proficiency level
   * @param mode - Processing mode
   * @returns Array of unprocessed nodes
   *
   * @example
   * const allNodes = [...textNodes]
   * const unprocessed = store.filterUnprocessed(allNodes, 'A1', 'original')
   * // Process only unprocessed nodes
   */
  filterUnprocessed(
    textNodes: Text[],
    userLevel: string,
    mode: 'original' | 'translated' = 'original'
  ): Text[] {
    const startTime = performance.now()
    const unprocessed = textNodes.filter(node => !this.isProcessed(node, userLevel, mode))
    const elapsed = performance.now() - startTime

    logger.debug(`Fingerprint filtering: ${textNodes.length} → ${unprocessed.length} (${elapsed.toFixed(2)}ms)`)

    return unprocessed
  }

  /**
   * Batch mark multiple nodes as processed
   * Optimized for processing arrays of text nodes
   *
   * @param textNodes - Array of text nodes
   * @param userLevel - User proficiency level
   * @param mode - Processing mode
   *
   * @example
   * store.batchMarkAsProcessed(processedNodes, 'A1', 'translated')
   */
  batchMarkAsProcessed(
    textNodes: Text[],
    userLevel: string,
    mode: 'original' | 'translated'
  ): void {
    const startTime = performance.now()

    for (const node of textNodes) {
      this.markAsProcessed(node, userLevel, mode)
    }

    const elapsed = performance.now() - startTime
    logger.debug(`Batch marked ${textNodes.length} nodes (${elapsed.toFixed(2)}ms)`)
  }

  /**
   * Remove fingerprint for a specific node
   * Not typically needed due to WeakMap auto-cleanup
   *
   * @param textNode - Text node to remove
   * @returns true if node was found and removed
   */
  remove(textNode: Text): boolean {
    return this.fingerprintMap.delete(textNode)
  }

  /**
   * Clear all fingerprints
   * Forces WeakMap to be garbage collected
   */
  clear(): void {
    this.fingerprintMap = new WeakMap<Text, NodeFingerprintInfo>()
    this.resetStats()

    logger.info('NodeFingerprintStore cleared')
  }

  /**
   * Get statistics
   * Useful for debugging and performance monitoring
   *
   * @returns Statistics object
   */
  getStats(): FingerprintStats {
    const total = this.stats.cacheHits + this.stats.cacheMisses
    const hitRate = total > 0 ? Math.round((this.stats.cacheHits / total) * 100) : 0

    return {
      ...this.stats,
      hitRate
    }
  }

  /**
   * Reset statistics
   * Does not clear fingerprints
   */
  resetStats(): void {
    this.stats = {
      totalMarked: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0
    }

    logger.debug('NodeFingerprintStore stats reset')
  }

  /**
   * Check if fingerprint matches for a specific text
   * Useful for pre-flight checks without accessing the node
   *
   * @param textNode - Text node to check
   * @param expectedHash - Expected text hash
   * @returns true if stored hash matches expected hash
   */
  matchesHash(textNode: Text, expectedHash: string): boolean {
    const info = this.fingerprintMap.get(textNode)
    return info?.textHash === expectedHash
  }

  /**
   * Get all nodes that match a specific hash
   * Note: WeakMap doesn't support iteration, so this method can't be implemented
   * This is a conceptual placeholder for documentation
   *
   * @deprecated WeakMap doesn't support iteration
   */
  getNodesByHash(_textHash: string): Text[] {
    throw new Error('WeakMap does not support iteration. Use filterUnprocessed instead.')
  }

  /**
   * Export statistics for logging
   * Formats stats as a readable string
   *
   * @returns Formatted statistics string
   */
  getStatsString(): string {
    const stats = this.getStats()
    return `NodeFingerprintStore Stats: Marked=${stats.totalMarked}, Hits=${stats.cacheHits}, Misses=${stats.cacheMisses}, HitRate=${stats.hitRate}%`
  }
}
