import type { TextNodeData } from '../utils/types'
import {
  generateNodeId,
  getDomPath,
  getTextNodePosition,
  isChineseText,
  hasVisibleText,
  isElementInViewport
} from '../utils/domHelpers'
import { ContainerFilter } from '../utils/ContainerFilter'
import { logger } from '../utils/logger'

export class TextExtractor {
  private containerFilter: ContainerFilter

  /**
   * 构造函数
   * @param containerFilter - 容器过滤器（用于黑/白名单过滤）
   */
  constructor(containerFilter: ContainerFilter) {
    this.containerFilter = containerFilter
  }

  /**
   * 提取视口内包含中文的文本节点
   * 注意：不再进行节点指纹检查，由 TextPlanner 统一处理
   */
  getVisibleChineseTextNodes(): TextNodeData[] {
    const textNodes: TextNodeData[] = []

    try {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const text = node.textContent || ''

            // 1. 检查是否包含中文
            if (!isChineseText(text)) {
              return NodeFilter.FILTER_REJECT
            }

            const parent = node.parentElement
            if (!parent) {
              return NodeFilter.FILTER_REJECT
            }

            // 2. 容器过滤（新增）- 递归检查父元素链
            if (!this.containerFilter.shouldProcessElementRecursive(parent)) {
              return NodeFilter.FILTER_REJECT
            }

            // 3. 检查父元素是否可见
            if (!hasVisibleText(parent)) {
              return NodeFilter.FILTER_REJECT
            }

            // 4. 检查是否在视口内
            if (!isElementInViewport(parent)) {
              return NodeFilter.FILTER_REJECT
            }

            // 注意：不再检查 processedNodes，由 TextPlanner 的 NodeFingerprintStore 统一处理

            return NodeFilter.FILTER_ACCEPT
          }
        }
      )

      let currentNode
      while ((currentNode = walker.nextNode())) {
        const nodeId = generateNodeId(currentNode)
        const textData: TextNodeData = {
          id: nodeId,
          text: currentNode.textContent || '',
          rect: getTextNodePosition(currentNode),
          path: getDomPath(currentNode.parentElement!),
          element: currentNode.parentElement!,
          node: currentNode as Text
        }

        textNodes.push(textData)
      }

      logger.debug(`提取到 ${textNodes.length} 个中文文本节点`)

      // 输出详细的节点信息
      if (textNodes.length > 0) {
        logger.group('📋 提取的文本节点详情')
        textNodes.forEach((node, index) => {
          logger.info(`节点 ${index + 1}:`)
          logger.info(`  - ID: ${node.id}`)
          logger.info(`  - 文本: "${node.text}"`)
          logger.info(`  - 长度: ${node.text.length}`)
          logger.info(`  - DOM路径: ${node.path}`)
          logger.info(`  - 位置: (${Math.round(node.rect.x)}, ${Math.round(node.rect.y)})`)
          logger.info(`  - 尺寸: ${Math.round(node.rect.width)}x${Math.round(node.rect.height)}`)
          logger.info(`  - 元素标签: ${node.element.tagName}`)
          logger.info(`  - 元素类名: ${node.element.className || '无'}`)
          logger.info('---')
        })
        logger.groupEnd()
      }

    } catch (error) {
      logger.error('提取文本节点时出错:', error)
    }

    return textNodes
  }

  /**
   * 重置已处理节点记录（用于页面重新加载）
   * 注意：已废弃，由 NodeFingerprintStore 管理
   * @deprecated Use NodeFingerprintStore.clear() instead
   */
  resetProcessedNodes() {
    logger.warn('resetProcessedNodes() is deprecated. Use NodeFingerprintStore.clear() instead')
  }

  /**
   * 标记节点为已处理
   * 注意：已废弃，由 NodeFingerprintStore 管理
   * @deprecated Use NodeFingerprintStore.markAsProcessed() instead
   */
  markNodeAsProcessed(nodeId: string) {
    logger.warn('markNodeAsProcessed() is deprecated. Use NodeFingerprintStore.markAsProcessed() instead')
  }

  /**
   * 检查节点是否已处理
   * 注意：已废弃，由 NodeFingerprintStore 管理
   * @deprecated Use NodeFingerprintStore.isProcessed() instead
   */
  isNodeProcessed(nodeId: string): boolean {
    logger.warn('isNodeProcessed() is deprecated. Use NodeFingerprintStore.isProcessed() instead')
    return false
  }

  /**
   * 获取已处理节点数量
   * 注意：已废弃，由 NodeFingerprintStore 管理
   * @deprecated Use NodeFingerprintStore.getStats() instead
   */
  getProcessedCount(): number {
    logger.warn('getProcessedCount() is deprecated. Use NodeFingerprintStore.getStats() instead')
    return 0
  }
}
