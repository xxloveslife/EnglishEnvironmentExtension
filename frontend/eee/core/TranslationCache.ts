import { TranslationResult, CacheItem } from '../utils/types'
import { logger } from '../utils/logger'

export class TranslationCache {
  private cache = new Map<string, CacheItem>()
  private maxSize: number
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }
  
  /**
   * 生成缓存键
   */
  private generateKey(text: string, userLevel: string): string {
    return `${text}-${userLevel}`
  }
  
  /**
   * 获取缓存的翻译结果
   */
  get(text: string, userLevel: string): TranslationResult[] | null {
    const key = this.generateKey(text, userLevel)
    const item = this.cache.get(key)
    
    if (item) {
      // 更新访问计数和时间
      item.accessCount++
      item.timestamp = Date.now()
      logger.debug(`缓存命中: ${text.substring(0, 20)}...`)
      return item.value
    }
    
    return null
  }
  
  /**
   * 设置缓存
   */
  set(text: string, userLevel: string, results: TranslationResult[]): void {
    const key = this.generateKey(text, userLevel)
    
    // 如果缓存已满，删除最少使用的项
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed()
    }
    
    const item: CacheItem = {
      key,
      value: results,
      timestamp: Date.now(),
      accessCount: 1
    }
    
    this.cache.set(key, item)
    logger.debug(`缓存设置: ${text.substring(0, 20)}...`)
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
