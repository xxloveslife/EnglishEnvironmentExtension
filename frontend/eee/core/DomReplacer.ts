import { TextNodeData, TranslationResult } from '../utils/types'
import { findElementByPath } from '../utils/domHelpers'
import { logger } from '../utils/logger'

export class DomReplacer {
  private replacedElements = new Set<string>()
  
  /**
   * 应用翻译结果到DOM
   */
  applyTranslations(
    textNodes: TextNodeData[], 
    translations: TranslationResult[]
  ): void {
    logger.group('🔄 开始应用翻译结果')
    
    try {
      logger.info(`准备应用 ${translations.length} 个翻译结果到 ${textNodes.length} 个节点`)
      
      // 按文本节点分组翻译结果
      const translationMap = new Map<string, TranslationResult[]>()
      
      translations.forEach((translation, index) => {
        if (index < textNodes.length) {
          const nodeId = textNodes[index].id
          if (!translationMap.has(nodeId)) {
            translationMap.set(nodeId, [])
          }
          translationMap.get(nodeId)!.push(translation)
          
          logger.debug(`翻译 ${index + 1}: "${translation.originalText}" → "${translation.translatedText}"`)
        }
      })
      
      // 应用翻译
      let appliedCount = 0
      translationMap.forEach((results, nodeId) => {
        const textNode = textNodes.find(n => n.id === nodeId)
        if (textNode) {
          logger.debug(`应用翻译到节点: ${nodeId}`)
          logger.debug(`  原文: "${textNode.text}"`)
          logger.debug(`  翻译数量: ${results.length}`)
          
          this.replaceTextInElement(textNode, results)
          appliedCount++
        }
      })
      
      logger.info(`✅ 成功应用 ${appliedCount} 个节点的翻译`)
      
    } catch (error) {
      logger.error('应用翻译结果时出错:', error)
    } finally {
      logger.groupEnd()
    }
  }
  
  /**
   * 在指定元素中替换文本
   */
  private replaceTextInElement(
    textNode: TextNodeData, 
    translations: TranslationResult[]
  ): void {
    const element = findElementByPath(textNode.path)
    if (!element) {
      logger.warn(`找不到元素: ${textNode.path}`)
      return
    }
    
    // 避免重复处理
    if (this.replacedElements.has(textNode.id)) {
      return
    }
    
    let html = element.innerHTML
    
    // 应用所有翻译
    translations.forEach(translation => {
      const replacement = this.createTranslationHtml(translation)
      html = html.replace(
        new RegExp(this.escapeRegExp(translation.originalText), 'g'),
        replacement
      )
    })
    
    // 更新HTML
    element.innerHTML = html
    this.replacedElements.add(textNode.id)
    
    logger.debug(`替换文本: ${textNode.text.substring(0, 20)}...`)
  }
  
  /**
   * 创建翻译HTML结构
   */
  private createTranslationHtml(translation: TranslationResult): string {
    const { translatedText, phonetic, chinese, confidence } = translation
    
    let html = `<span class="eee-translated-word" data-confidence="${confidence}">`
    html += `<span class="eee-english">${translatedText}</span>`
    
    if (phonetic) {
      html += `<span class="eee-phonetic">[${phonetic}]</span>`
    }
    
    if (chinese) {
      html += `<span class="eee-chinese">（${chinese}）</span>`
    }
    
    html += '</span>'
    
    return html
  }
  
  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  
  /**
   * 应用降级翻译（简单替换）
   */
  applyFallbackTranslations(textNodes: TextNodeData[]): void {
    logger.group('🔄 应用降级翻译')
    
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
   */
  resetReplacedElements(): void {
    this.replacedElements.clear()
    logger.debug('已重置替换记录')
  }
  
  /**
   * 获取已替换元素数量
   */
  getReplacedCount(): number {
    return this.replacedElements.size
  }
}
