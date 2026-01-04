import type { TextNodeData, TextCandidate } from '../utils/types'
import { findElementByPath } from '../utils/domHelpers'
import { NodeFingerprintStore } from '../utils/NodeFingerprintStore'
import { logger } from '../utils/logger'

export class DomReplacer {
  private replacedElements = new Set<string>()
  private fingerprintStore: NodeFingerprintStore

  /**
   * 构造函数
   * @param fingerprintStore - 节点指纹存储（用于标记已处理节点）
   */
  constructor(fingerprintStore: NodeFingerprintStore) {
    this.fingerprintStore = fingerprintStore
  }

  /**
   * 应用翻译到 DOM（新架构推荐方法）
   * 使用 TextCandidate 和 hash-to-translation 映射
   *
   * @param candidates - 文本候选项数组
   * @param hashToTranslation - 哈希到翻译的映射
   * @param userLevel - 用户等级
   * @returns 成功应用的节点数量
   *
   * @example
   * const applied = replacer.applyTranslations(plan.toSend, hashToTranslation, 'A1')
   */
  applyTranslations(
    candidates: TextCandidate[],
    hashToTranslation: Map<string, string>,
    userLevel: string
  ): number {
    const startTime = performance.now()
    let applied = 0

    logger.group('🎯 应用翻译到 DOM')

    try {
      logger.info(`准备应用 ${candidates.length} 个候选项的翻译`)

      for (const candidate of candidates) {
        const translation = hashToTranslation.get(candidate.textHash)

        if (!translation || translation.length === 0) {
          logger.warn(`未找到翻译: hash=${candidate.textHash.substring(0, 8)}...`)
          continue
        }

        const node = candidate.node

        // 严格的 isConnected 检查（节点和父元素都必须在 DOM 中）
        if (!node.isConnected || !node.parentElement?.isConnected) {
          logger.warn(`节点已从 DOM 移除: "${candidate.normalizedText.substring(0, 20)}..."`)
          continue
        }

        // 应用翻译
        try {
          node.textContent = translation

          // 更新节点指纹（标记为 'translated' 模式）
          this.fingerprintStore.markAsProcessed(node, userLevel, 'translated')

          // 兼容旧的 replacedElements 跟踪
          this.replacedElements.add(candidate.nodeData.id)

          applied++

          logger.debug(`✓ "${candidate.normalizedText.substring(0, 15)}..." → "${translation.substring(0, 15)}..."`)
        } catch (error) {
          logger.error(`应用翻译失败: "${candidate.normalizedText.substring(0, 20)}..."`, error)
        }
      }

      const elapsed = performance.now() - startTime

      logger.info(`成功应用 ${applied}/${candidates.length} 个翻译`)
      logger.info(`Apply 完成: ${applied} 个节点 (${elapsed.toFixed(2)}ms)`)

      return applied
    } catch (error) {
      logger.error('应用翻译时出错:', error)
      return applied
    } finally {
      logger.groupEnd()
    }
  }

  /**
   * 应用整段翻译结果到 DOM（旧架构兼容方法）
   * - 按 index 与 textNodes 对齐
   * - 直接修改 Text 节点 textContent，避免 innerHTML 匹配失败
   * - 仅成功替换的节点会被标记为 replaced
   *
   * @deprecated Use applyTranslations() with TextCandidate instead
   */
  applyTranslatedTexts(textNodes: TextNodeData[], translatedTexts: string[]): string[] {
    logger.group('🔄 开始应用翻译结果(整段替换)')
    logger.warn('applyTranslatedTexts() is deprecated. Use applyTranslations() instead')

    const replacedNodeIds: string[] = []

    try {
      logger.info(`准备应用 ${translatedTexts.length} 个翻译结果到 ${textNodes.length} 个节点`)

      const len = Math.min(textNodes.length, translatedTexts.length)
      for (let i = 0; i < len; i++) {
        const node = textNodes[i]
        const translated = translatedTexts[i]

        if (!node || typeof translated !== 'string' || translated.length === 0) {
          continue
        }

        if (this.replacedElements.has(node.id)) {
          continue
        }

        // 优先使用采集到的 Text 节点引用
        const textNode = node.node
        if (textNode && (textNode as any).isConnected) {
          textNode.textContent = translated
          this.replacedElements.add(node.id)
          replacedNodeIds.push(node.id)
          continue
        }

        // 兜底：如果 Text 节点已被销毁，尝试用 path 找回元素并做降级替换
        const element = findElementByPath(node.path)
        if (!element) {
          continue
        }

        // 降级策略：仅当 element 的纯文本里能找到原文本时，替换它的 textContent
        const before = element.textContent || ''
        if (before.includes(node.text)) {
          element.textContent = before.replace(node.text, translated)
          this.replacedElements.add(node.id)
          replacedNodeIds.push(node.id)
        }
      }

      logger.info(`✅ 成功应用 ${replacedNodeIds.length} 个节点的翻译`)
      return replacedNodeIds
    } catch (error) {
      logger.error('应用翻译结果时出错:', error)
      return replacedNodeIds
    } finally {
      logger.groupEnd()
    }
  }

  // 旧的"innerHTML 替换 + span 结构"模式暂时保留在历史中；
  // 目前最小版本只做整段替换，不需要在这里做词级别富文本替换。

  // 词级别替换/富文本替换：后续阶段2再实现

  /**
   * 应用降级翻译（简单替换）
   * @deprecated Fallback translations are handled by API
   */
  applyFallbackTranslations(textNodes: TextNodeData[]): void {
    logger.group('🔄 应用降级翻译')
    logger.warn('applyFallbackTranslations() is deprecated')

    const fallbackMap: Record<string, string> = {
      '厉害': 'awesome[ˈɔːsəm](厉害)',
      '漂亮': 'beautiful[ˈbjuːtɪfl](漂亮)',
      '聪明': 'smart[smɑːt](聪明)',
      '快乐': 'happy[ˈhæpi](快乐)',
      '美丽': 'beautiful[ˈbjuːtɪfl](美丽)',
      '重要': 'important[ɪmˈpɔːtnt](重要)',
      '困难': 'difficult[ˈdɪfɪkəlt](困难)',
      '简单': 'simple[ˈsɪmpl](简单)',
      '快速': 'fast[fɑːst](快速)',
      '慢速': 'slow[sləʊ](慢速)'
    }

    try {
      textNodes.forEach(textNode => {
        const element = findElementByPath(textNode.path)
        if (!element || this.replacedElements.has(textNode.id)) {
          return
        }

        let html = element.innerHTML

        // 应用降级替换
        Object.entries(fallbackMap).forEach(([chinese, english]) => {
          const replacement = `<span class="eee-translated-word eee-fallback">${english}</span>`
          html = html.replace(new RegExp(chinese, 'g'), replacement)
        })

        element.innerHTML = html
        this.replacedElements.add(textNode.id)
      })

      logger.info(`应用了 ${textNodes.length} 个降级翻译`)

    } catch (error) {
      logger.error('应用降级翻译时出错:', error)
    } finally {
      logger.groupEnd()
    }
  }

  /**
   * 重置替换记录
   * @deprecated Use NodeFingerprintStore.clear() instead
   */
  resetReplacedElements(): void {
    this.replacedElements.clear()
    logger.debug('已重置替换记录')
    logger.warn('resetReplacedElements() is deprecated. Use NodeFingerprintStore.clear() instead')
  }

  /**
   * 获取已替换元素数量
   * @deprecated Use NodeFingerprintStore.getStats() instead
   */
  getReplacedCount(): number {
    return this.replacedElements.size
  }
}
