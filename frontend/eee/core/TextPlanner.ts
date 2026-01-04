/**
 * Text Planner - Translation Plan Generator
 *
 * Coordinates all optimization modules to create translation plans
 * Implements three-layer deduplication:
 * 1. Node Fingerprint (WeakMap) - same node, same content
 * 2. Text Cache (LRU) - same text across different nodes
 * 3. Batch Deduplication - unique texts within same batch
 */

import type {
  TextNodeData,
  TextCandidate,
  TranslationPlan,
  TranslationPlanStats
} from '../utils/types'
import { TranslationCache } from './TranslationCache'
import { NodeFingerprintStore } from '../utils/NodeFingerprintStore'
import { hashText, generateCacheKey } from '../utils/HashUtils'
import { normalizeText, needsNormalization } from '../utils/TextNormalizer'
import { logger } from '../utils/logger'

export class TextPlanner {
  private fingerprintStore: NodeFingerprintStore

  constructor(fingerprintStore: NodeFingerprintStore) {
    this.fingerprintStore = fingerprintStore
  }

  /**
   * Create translation plan from text nodes
   * Implements three-layer deduplication strategy
   *
   * @param textNodes - Array of text node data from TextExtractor
   * @param cache - Translation cache instance
   * @param userLevel - User proficiency level (A1-C2)
   * @returns Complete translation plan
   *
   * @example
   * const plan = planner.createTranslationPlan(textNodes, cache, 'A1')
   * console.log(plan.stats) // View statistics
   */
  createTranslationPlan(
    textNodes: TextNodeData[],
    cache: TranslationCache,
    userLevel: string
  ): TranslationPlan {
    const startTime = performance.now()

    logger.group('📋 创建翻译计划')

    // Initialize stats
    const stats: TranslationPlanStats = {
      total: textNodes.length,
      fingerprintFiltered: 0,
      cached: 0,
      toSend: 0,
      unique: 0,
      normalized: 0,
      batchDedupSaved: 0
    }

    // Step 1: Filter by node fingerprint (first layer deduplication)
    logger.info('Step 1: 节点指纹过滤')
    const unfingerprintedNodes = this.fingerprintStore.filterUnprocessed(
      textNodes.map(data => data.node),
      userLevel,
      'original'
    )

    stats.fingerprintFiltered = textNodes.length - unfingerprintedNodes.length

    if (stats.fingerprintFiltered > 0) {
      logger.info(`指纹过滤：${textNodes.length} → ${unfingerprintedNodes.length}`)
    }

    // Build nodeData map for quick lookup
    const nodeDataMap = new Map<Text, TextNodeData>()
    for (const data of textNodes) {
      nodeDataMap.set(data.node, data)
    }

    // Step 2: Create candidates with normalization and hashing
    logger.info('Step 2: 规范化、哈希计算、缓存检查')
    const candidates: TextCandidate[] = []
    const toApplyFromCache: Array<{ candidate: TextCandidate; translated: string }> = []
    const toSend: TextCandidate[] = []

    for (const node of unfingerprintedNodes) {
      const nodeData = nodeDataMap.get(node)
      if (!nodeData) continue

      const rawText = nodeData.text
      const normalizedText = normalizeText(rawText)
      const textHash = hashText(normalizedText)
      const cacheKey = generateCacheKey(textHash, userLevel)

      // Track normalization effect
      if (needsNormalization(rawText)) {
        stats.normalized++
      }

      const candidate: TextCandidate = {
        nodeData,
        node,
        element: nodeData.element,
        rawText,
        normalizedText,
        textHash,
        cacheKey
      }

      candidates.push(candidate)

      // Check cache (second layer deduplication)
      const cached = cache.getByHash(textHash, userLevel)

      if (cached !== null && cached.length > 0) {
        toApplyFromCache.push({ candidate, translated: cached })
        stats.cached++
        logger.debug(`缓存命中: "${normalizedText.substring(0, 20)}..." -> "${cached.substring(0, 20)}..."`)
      } else {
        toSend.push(candidate)
      }
    }

    stats.toSend = toSend.length

    logger.info(`需要 API 处理: ${stats.toSend} 个`)

    // Step 3: Batch deduplication (third layer)
    logger.info('Step 3: 批次去重')
    const { uniqueTexts, textHashMap } = this.batchDeduplicate(toSend)

    stats.unique = uniqueTexts.length
    stats.batchDedupSaved = stats.toSend - stats.unique

    if (stats.batchDedupSaved > 0) {
      const savedPercentage = Math.round((stats.batchDedupSaved / stats.toSend) * 100)
      logger.info(`批次去重节省: ${stats.batchDedupSaved} 个请求 (${savedPercentage}%)`)
    }

    // Build translation plan
    const plan: TranslationPlan = {
      toApplyFromCache,
      toSend,
      uniqueTexts,
      textHashMap,
      stats
    }

    const elapsed = performance.now() - startTime

    // Log statistics
    logger.info('翻译计划统计:')
    logger.info(`  - 总节点数: ${stats.total}`)
    logger.info(`  - 指纹过滤: ${stats.fingerprintFiltered}`)
    logger.info(`  - 缓存命中: ${stats.cached}`)
    logger.info(`  - 需要 API: ${stats.toSend}`)
    logger.info(`  - 去重后唯一文本: ${stats.unique}`)
    logger.info(`  - 规范化影响: ${stats.normalized}`)

    logger.info(`Plan 完成 (${elapsed.toFixed(2)}ms)`)
    logger.groupEnd()

    return plan
  }

  /**
   * Batch deduplicate texts for API call
   * Groups candidates by text hash
   *
   * @param candidates - Candidates to send to API
   * @returns Unique texts and hash mapping
   */
  private batchDeduplicate(candidates: TextCandidate[]): {
    uniqueTexts: string[]
    textHashMap: Map<string, TextCandidate[]>
  } {
    const textHashMap = new Map<string, TextCandidate[]>()
    const seenHashes = new Set<string>()
    const uniqueTexts: string[] = []

    for (const candidate of candidates) {
      const hash = candidate.textHash

      // Add to hash map (for result mapping)
      if (!textHashMap.has(hash)) {
        textHashMap.set(hash, [])
      }
      textHashMap.get(hash)!.push(candidate)

      // Add to unique texts (for API call)
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash)
        uniqueTexts.push(candidate.normalizedText)
      }
    }

    return { uniqueTexts, textHashMap }
  }

  /**
   * Apply cached translations immediately
   * Updates DOM and marks nodes as processed
   *
   * @param plan - Translation plan
   * @returns Number of translations applied
   *
   * @example
   * const applied = planner.applyCachedTranslations(plan)
   * logger.info(`Applied ${applied} cached translations`)
   */
  applyCachedTranslations(plan: TranslationPlan): number {
    if (plan.toApplyFromCache.length === 0) {
      return 0
    }

    const startTime = performance.now()
    let applied = 0

    logger.group('🎯 应用缓存翻译')

    for (const { candidate, translated } of plan.toApplyFromCache) {
      const node = candidate.node

      // Check if node is still in DOM
      if (!node.isConnected || !node.parentElement?.isConnected) {
        logger.warn(`节点已从 DOM 移除，跳过: "${candidate.normalizedText.substring(0, 20)}..."`)
        continue
      }

      // Apply translation
      node.textContent = translated

      // Mark as processed with 'translated' mode
      this.fingerprintStore.markAsProcessed(node, this.extractUserLevel(candidate.cacheKey), 'translated')

      applied++
    }

    const elapsed = performance.now() - startTime

    logger.info(`成功应用 ${applied}/${plan.toApplyFromCache.length} 个缓存翻译`)
    logger.info(`Apply 完成 (${elapsed.toFixed(2)}ms)`)
    logger.groupEnd()

    return applied
  }

  /**
   * Merge API results back to candidates
   * Creates hash-to-translation mapping for DOM application
   *
   * @param plan - Translation plan
   * @param apiResults - Results from API (aligned with plan.uniqueTexts)
   * @returns Map of text hash to translated text
   *
   * @example
   * const hashToTranslation = planner.mergeApiResults(plan, apiResults)
   * // Use hashToTranslation with DomReplacer
   */
  mergeApiResults(
    plan: TranslationPlan,
    apiResults: string[]
  ): Map<string, string> {
    const startTime = performance.now()

    logger.group('🔄 合并 API 结果')

    if (apiResults.length !== plan.uniqueTexts.length) {
      logger.error(
        `API 结果长度不匹配: expected ${plan.uniqueTexts.length}, got ${apiResults.length}`
      )
      throw new Error('API results length mismatch with unique texts')
    }

    const hashToTranslation = new Map<string, string>()

    // Build normalized text to translation map
    const textToTranslation = new Map<string, string>()
    for (let i = 0; i < plan.uniqueTexts.length; i++) {
      textToTranslation.set(plan.uniqueTexts[i], apiResults[i])
    }

    // Map translations to all candidates (handles duplicates)
    let mapped = 0
    for (const [hash, candidates] of plan.textHashMap) {
      const normalizedText = candidates[0].normalizedText
      const translation = textToTranslation.get(normalizedText)

      if (translation && translation.length > 0) {
        hashToTranslation.set(hash, translation)
        mapped += candidates.length
        logger.debug(`映射翻译: hash=${hash.substring(0, 8)}... -> ${candidates.length} 个候选项`)
      } else {
        logger.warn(`API 返回空翻译: "${normalizedText.substring(0, 20)}..."`)
      }
    }

    const elapsed = performance.now() - startTime

    logger.info(`合并 ${hashToTranslation.size} 个翻译结果`)
    logger.info(`映射到 ${mapped} 个候选项`)
    logger.info(`Merge 完成 (${elapsed.toFixed(2)}ms)`)
    logger.groupEnd()

    return hashToTranslation
  }

  /**
   * Extract user level from cache key
   * Cache key format: "textHash:userLevel"
   */
  private extractUserLevel(cacheKey: string): string {
    const parts = cacheKey.split(':')
    return parts[1] || 'A1' // Default to A1 if not found
  }

  /**
   * Get statistics summary string
   *
   * @param plan - Translation plan
   * @returns Formatted statistics string
   */
  getStatsSummary(plan: TranslationPlan): string {
    const { stats } = plan
    const lines = [
      `Total: ${stats.total}`,
      `Fingerprint Filtered: ${stats.fingerprintFiltered}`,
      `Cached: ${stats.cached}`,
      `To Send: ${stats.toSend}`,
      `Unique: ${stats.unique}`,
      `Normalized: ${stats.normalized}`,
      `Batch Dedup Saved: ${stats.batchDedupSaved}`
    ]
    return lines.join(', ')
  }

  /**
   * Validate translation plan integrity
   * Useful for debugging
   *
   * @param plan - Translation plan to validate
   * @returns true if plan is valid
   */
  validatePlan(plan: TranslationPlan): boolean {
    const { stats, toApplyFromCache, toSend, uniqueTexts, textHashMap } = plan

    // Check stats consistency
    const expectedTotal = stats.fingerprintFiltered + toApplyFromCache.length + toSend.length
    if (stats.total !== expectedTotal) {
      logger.error(
        `Plan validation failed: total mismatch (${stats.total} !== ${expectedTotal})`
      )
      return false
    }

    // Check unique texts count
    if (uniqueTexts.length !== stats.unique) {
      logger.error(
        `Plan validation failed: unique texts count mismatch (${uniqueTexts.length} !== ${stats.unique})`
      )
      return false
    }

    // Check hash map size
    if (textHashMap.size !== uniqueTexts.length) {
      logger.error(
        `Plan validation failed: hash map size mismatch (${textHashMap.size} !== ${uniqueTexts.length})`
      )
      return false
    }

    logger.debug('Plan validation passed')
    return true
  }
}
