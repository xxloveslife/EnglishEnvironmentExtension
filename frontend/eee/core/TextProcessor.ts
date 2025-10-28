import { 
  ITextProcessor, 
  IApiService, 
  IStorageService, 
  UserConfig,
  TextNodeData,
  TranslationResult 
} from '../utils/types'
import { TextExtractor } from './TextExtractor'
import { DomReplacer } from './DomReplacer'
import { TranslationCache } from './TranslationCache'
import { ScrollObserver } from '../observers/ScrollObserver'
import { DomObserver } from '../observers/DomObserver'
import { ViewportObserver } from '../observers/ViewportObserver'
import { batchProcessor } from '../utils/throttle'
import { logger } from '../utils/logger'

export class TextProcessor implements ITextProcessor {
  private textExtractor: TextExtractor
  private domReplacer: DomReplacer
  private translationCache: TranslationCache
  private scrollObserver: ScrollObserver
  private domObserver: DomObserver
  private viewportObserver: ViewportObserver
  private apiService: IApiService
  private storageService: IStorageService
  
  private isProcessing = false
  private batchProcessor: (textNodes: TextNodeData[]) => void
  
  constructor(
    apiService: IApiService,
    storageService: IStorageService
  ) {
    this.textExtractor = new TextExtractor()
    this.domReplacer = new DomReplacer()
    this.translationCache = new TranslationCache()
    this.scrollObserver = new ScrollObserver()
    this.domObserver = new DomObserver()
    this.viewportObserver = new ViewportObserver()
    this.apiService = apiService
    this.storageService = storageService
    
    // 批量处理器
    this.batchProcessor = batchProcessor(
      (textNodes: TextNodeData[]) => this.processTextNodes(textNodes),
      200
    )
    
    this.setupEventListeners()
  }
  
  /**
   * 启动文本处理器
   */
  async start(): Promise<void> {
    try {
      const config = await this.storageService.getConfig()
      
      if (!config.enabled) {
        logger.info('插件未启用，跳过启动')
        return
      }
      
      logger.group('🚀 启动文本处理器')
      
      // 根据配置启动观察器
      if (config.processingConfig.onScroll) {
        this.scrollObserver.start()
      }
      
      if (config.processingConfig.onDomChange) {
        this.domObserver.start()
      }
      
      // 初始处理
      if (config.processingConfig.onPageLoad) {
        await this.processVisibleText()
      }
      
      logger.info('文本处理器启动成功')
      logger.groupEnd()
      
    } catch (error) {
      logger.error('启动文本处理器失败:', error)
    }
  }
  
  /**
   * 停止文本处理器
   */
  stop(): void {
    logger.group('🛑 停止文本处理器')
    
    this.scrollObserver.stop()
    this.domObserver.stop()
    this.viewportObserver.stop()
    
    // 重置状态
    this.textExtractor.resetProcessedNodes()
    this.domReplacer.resetReplacedElements()
    
    logger.info('文本处理器已停止')
    logger.groupEnd()
  }
  
  /**
   * 处理可见文本
   */
  async processVisibleText(): Promise<void> {
    if (this.isProcessing) {
      logger.debug('正在处理中，跳过本次请求')
      return
    }
    
    this.isProcessing = true
    
    try {
      logger.group('📝 处理可见文本')
      
      const textNodes = this.textExtractor.getVisibleChineseTextNodes()
      
      if (textNodes.length === 0) {
        logger.debug('没有找到需要处理的中文文本')
        return
      }
      
      logger.info(`找到 ${textNodes.length} 个文本节点`)
      
      // 显示文本节点统计信息
      if (textNodes.length > 0) {
        const totalChars = textNodes.reduce((sum, node) => sum + node.text.length, 0)
        const avgLength = Math.round(totalChars / textNodes.length)
        const chineseNodes = textNodes.filter(node => /[\u4e00-\u9fa5]/.test(node.text))
        
        logger.info(`文本统计:`)
        logger.info(`  - 总字符数: ${totalChars}`)
        logger.info(`  - 平均长度: ${avgLength}`)
        logger.info(`  - 包含中文的节点: ${chineseNodes.length}`)
        logger.info(`  - 纯中文节点: ${textNodes.filter(node => /^[\u4e00-\u9fa5]+$/.test(node.text)).length}`)
      }
      
      // 使用批量处理器
      this.batchProcessor(textNodes)
      
    } catch (error) {
      logger.error('处理可见文本时出错:', error)
    } finally {
      this.isProcessing = false
      logger.groupEnd()
    }
  }
  
  /**
   * 处理文本节点
   */
  private async processTextNodes(textNodes: TextNodeData[]): Promise<void> {
    try {
      const config = await this.storageService.getConfig()
      
      logger.group('🔄 处理文本节点')
      logger.info(`开始处理 ${textNodes.length} 个文本节点`)
      
      // 检查缓存
      const uncachedNodes: TextNodeData[] = []
      const cachedResults: TranslationResult[] = []
      
      for (const node of textNodes) {
        const cached = this.translationCache.get(node.text, config.userLevel)
        if (cached) {
          cachedResults.push(...cached)
          logger.debug(`缓存命中: "${node.text.substring(0, 20)}..."`)
        } else {
          uncachedNodes.push(node)
        }
      }
      
      logger.info(`缓存命中: ${cachedResults.length} 个`)
      logger.info(`需要API处理: ${uncachedNodes.length} 个`)
      
      // 处理未缓存的文本
      let apiResults: TranslationResult[] = []
      if (uncachedNodes.length > 0) {
        try {
          const texts = uncachedNodes.map(node => node.text)
          
          logger.info('📤 准备发送给后台的文本:')
          texts.forEach((text, index) => {
            logger.info(`  ${index + 1}. "${text}"`)
          })
          
          apiResults = await this.apiService.processTexts(texts, config.userLevel)
          
          // 缓存结果
          uncachedNodes.forEach((node, index) => {
            if (apiResults[index]) {
              this.translationCache.set(node.text, config.userLevel, [apiResults[index]])
            }
          })
          
        } catch (error) {
          logger.error('API调用失败，使用降级方案:', error)
          this.domReplacer.applyFallbackTranslations(uncachedNodes)
          return
        }
      }
      
      // 合并所有结果
      const allResults = [...cachedResults, ...apiResults]
      
      logger.info(`📥 处理结果统计:`)
      logger.info(`  - 缓存结果: ${cachedResults.length} 个`)
      logger.info(`  - API结果: ${apiResults.length} 个`)
      logger.info(`  - 总结果: ${allResults.length} 个`)
      
      if (allResults.length > 0) {
        logger.info('🎯 开始应用翻译到DOM...')
        this.domReplacer.applyTranslations(textNodes, allResults)
        logger.info('✅ 翻译应用完成')
      } else {
        logger.warn('⚠️ 没有翻译结果可以应用')
      }
      
      logger.groupEnd()
      
    } catch (error) {
      logger.error('处理文本节点时出错:', error)
    }
  }
  
  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 滚动事件
    this.scrollObserver.on('scroll', () => {
      this.processVisibleText()
    })
    
    // DOM变化事件
    this.domObserver.on('domChange', () => {
      this.processVisibleText()
    })
    
    // 配置变化监听
    this.storageService.watchConfig((config: UserConfig) => {
      if (config.enabled) {
        this.start()
      } else {
        this.stop()
      }
    })
  }
  
  /**
   * 获取处理器状态
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      processedNodes: this.textExtractor.getProcessedCount(),
      replacedElements: this.domReplacer.getReplacedCount(),
      cacheStats: this.translationCache.getStats(),
      viewportInfo: this.viewportObserver.getViewportInfo()
    }
  }
}
