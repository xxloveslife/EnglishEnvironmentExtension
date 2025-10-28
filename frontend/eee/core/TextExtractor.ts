import { TextNodeData, TranslationResult, EnglishLevel } from '../utils/types'
import { 
  generateNodeId, 
  getDomPath, 
  getTextNodePosition, 
  isChineseText, 
  hasVisibleText,
  isElementInViewport 
} from '../utils/domHelpers'
import { logger } from '../utils/logger'

export class TextExtractor {
  private processedNodes = new Set<string>()
  
  /**
   * 提取视口内包含中文的文本节点
   */
  getVisibleChineseTextNodes(): TextNodeData[] {
    const textNodes: TextNodeData[] = []
    
    try {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // 检查是否包含中文
            if (!isChineseText(node.textContent || '')) {
              return NodeFilter.FILTER_REJECT
            }
            
            // 检查父元素是否可见
            const parent = node.parentElement
            if (!parent || !hasVisibleText(parent)) {
              return NodeFilter.FILTER_REJECT
            }
            
            // 检查是否在视口内
            if (!isElementInViewport(parent)) {
              return NodeFilter.FILTER_REJECT
            }
            
            // 过滤掉已经处理过的节点
            const nodeId = generateNodeId(node)
            if (this.processedNodes.has(nodeId)) {
              return NodeFilter.FILTER_REJECT
            }
            
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
          element: currentNode.parentElement!
        }
        
        textNodes.push(textData)
        this.processedNodes.add(nodeId)
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
   */
  resetProcessedNodes() {
    this.processedNodes.clear()
    logger.debug('已重置处理节点记录')
  }
  
  /**
   * 标记节点为已处理
   */
  markNodeAsProcessed(nodeId: string) {
    this.processedNodes.add(nodeId)
  }
  
  /**
   * 检查节点是否已处理
   */
  isNodeProcessed(nodeId: string): boolean {
    return this.processedNodes.has(nodeId)
  }
  
  /**
   * 获取已处理节点数量
   */
  getProcessedCount(): number {
    return this.processedNodes.size
  }
}
