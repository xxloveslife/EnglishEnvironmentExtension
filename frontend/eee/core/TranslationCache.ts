import type { CacheItem } from '../utils/types'
import { logger } from '../utils/logger'
import { hashText, generateCacheKey } from '../utils/HashUtils'
import { normalizeText } from '../utils/TextNormalizer'

export class TranslationCache {
  private cache = new Map<string, CacheItem>()
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }

  /**
   * 生成缓存键（已废弃，使用 generateCacheKey from HashUtils）
   * @deprecated Use getByHash/setByHash for better performance
   */
  private generateKey(text: string, userLevel: string): string {
    return `${text}-${userLevel}`
  }

  /**
   * 获取缓存的翻译结果（基于文本哈希）
   * 推荐使用此方法，性能更好且支持规范化
   *
   * @param textHash - 文本哈希值（FNV-1a）
   * @param userLevel - 用户等级
   * @returns 翻译文本或 null
   */
  getByHash(textHash: string, userLevel: string): string | null {
    const key = generateCacheKey(textHash, userLevel)
    const item = this.cache.get(key)

    if (item) {
      // 更新访问计数和时间
      item.accessCount++
      item.timestamp = Date.now()
      logger.debug(`缓存命中 (hash): ${textHash.substring(0, 8)}...`)
      return item.value
    }

    return null
  }

  /**
   * 设置缓存（基于文本哈希）
   * 推荐使用此方法，性能更好且支持规范化
   *
   * @param textHash - 文本哈希值（FNV-1a）
   * @param userLevel - 用户等级
   * @param translated - 翻译文本
   */
  setByHash(textHash: string, userLevel: string, translated: string): void {
    const key = generateCacheKey(textHash, userLevel)

    // 如果缓存已满，删除最少使用的项
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed()
    }

    const item: CacheItem = {
      key,
      value: translated,
      timestamp: Date.now(),
      accessCount: 1
    }

    this.cache.set(key, item)
    logger.debug(`缓存设置 (hash): ${textHash.substring(0, 8)}...`)
  }

  /**
   * 获取缓存的翻译结果（自动规范化和哈希）
   * 兼容原有代码，内部调用 getByHash
   *
   * @param text - 原始文本
   * @param userLevel - 用户等级
   * @returns 翻译文本或 null
   */
  get(text: string, userLevel: string): string | null {
    // 规范化文本
    const normalized = normalizeText(text)

    // 计算哈希
    const hash = hashText(normalized)

    // 调用基于哈希的方法
    return this.getByHash(hash, userLevel)
  }

  /**
   * 设置缓存（自动规范化和哈希）
   * 兼容原有代码，内部调用 setByHash
   *
   * @param text - 原始文本
   * @param userLevel - 用户等级
   * @param translated - 翻译文本
   */
  set(text: string, userLevel: string, translated: string): void {
    // 规范化文本
    const normalized = normalizeText(text)

    // 计算哈希
    const hash = hashText(normalized)

    // 调用基于哈希的方法
    this.setByHash(hash, userLevel, translated)
  }
  
  /**
   * 删除最少使用的缓存项
   */
  private evictLeastUsed(): void {
    let leastUsedKey = ''
    let leastUsedScore = Infinity
    
    for (const [key, item] of this.cache) {
      // 计算分数：访问次数越少，时间越久，分数越高（越应该被删除）
      const score = item.accessCount / (Date.now() - item.timestamp + 1)
      if (score < leastUsedScore) {
        leastUsedScore = score
        leastUsedKey = key
      }
    }
    
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey)
      logger.debug(`删除缓存项: ${leastUsedKey}`)
    }
  }
  
  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
    logger.debug('缓存已清空')
  }
  
  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate()
    }
  }
  
  /**
   * 计算命中率（简化版本）
   */
  private calculateHitRate(): number {
    const totalAccess = Array.from(this.cache.values())
      .reduce((sum, item) => sum + item.accessCount, 0)
    
    return totalAccess > 0 ? this.cache.size / totalAccess : 0
  }
}
