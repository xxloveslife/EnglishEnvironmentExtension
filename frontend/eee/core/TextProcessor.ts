import type {
  ITextProcessor,
  IApiService,
  IStorageService,
  UserConfig
} from '../utils/types'
import { TextExtractor } from './TextExtractor'
import { DomReplacer } from './DomReplacer'
import { TranslationCache } from './TranslationCache'
import { TextPlanner } from './TextPlanner'
import { ScrollObserver } from '../observers/ScrollObserver'
import { DomObserver } from '../observers/DomObserver'
import { ViewportObserver } from '../observers/ViewportObserver'
import { NodeFingerprintStore } from '../utils/NodeFingerprintStore'
import { ContainerFilter } from '../utils/ContainerFilter'
import { logger } from '../utils/logger'

export class TextProcessor implements ITextProcessor {
  // Core modules (new architecture)
  private fingerprintStore: NodeFingerprintStore
  private containerFilter: ContainerFilter
  private translationCache: TranslationCache
  private textPlanner: TextPlanner
  private textExtractor: TextExtractor
  private domReplacer: DomReplacer

  // Observer modules
  private scrollObserver: ScrollObserver
  private domObserver: DomObserver
  private viewportObserver: ViewportObserver

  // Services
  private apiService: IApiService
  private storageService: IStorageService

  // State flags
  private isProcessing = false
  private pendingRequest: Promise<void> | null = null
  private apiCallInProgress = false  // 追踪API调用状态

  constructor(
    apiService: IApiService,
    storageService: IStorageService
  ) {
    // Initialize new modules first
    this.fingerprintStore = new NodeFingerprintStore()
    this.containerFilter = new ContainerFilter()
    this.translationCache = new TranslationCache()
    this.textPlanner = new TextPlanner(this.fingerprintStore)

    // Initialize core modules with dependencies
    this.textExtractor = new TextExtractor(this.containerFilter)
    this.domReplacer = new DomReplacer(this.fingerprintStore)

    // Initialize observers
    this.scrollObserver = new ScrollObserver()
    this.domObserver = new DomObserver()
    this.viewportObserver = new ViewportObserver()

    // Store services
    this.apiService = apiService
    this.storageService = storageService

    this.setupEventListeners()

    logger.info('TextProcessor 初始化完成（新架构）')
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

      logger.group('🚀 启动文本处理器（新架构）')

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
    this.fingerprintStore.clear()

    logger.info('文本处理器已停止')
    logger.groupEnd()
  }

  /**
   * 处理可见文本（四阶段流水线）
   */
  async processVisibleText(): Promise<void> {
    // 如果有API调用正在进行，跳过本次请求
    if (this.apiCallInProgress) {
      logger.debug('API调用进行中，跳过本次请求')
      return
    }

    // 如果有请求正在处理，等待其完成
    if (this.pendingRequest) {
      logger.debug('等待现有请求完成...')
      await this.pendingRequest
      return
    }

    if (this.isProcessing) {
      logger.debug('正在处理中，跳过本次请求')
      return
    }

    this.isProcessing = true

    // 创建处理 Promise，追踪整个处理周期
    const processingPromise = (async () => {
      try {
        await this.processVisibleTextInternal()
      } catch (error) {
        logger.error('处理可见文本时出错:', error)
      } finally {
        this.isProcessing = false
        this.pendingRequest = null
      }
    })()

    this.pendingRequest = processingPromise
    await processingPromise
  }

  /**
   * 四阶段流水线内部实现
   * Phase 1: Collect - 提取文本节点
   * Phase 2: Plan - 生成翻译计划（去重、缓存检查）
   * Phase 3: Dispatch - API调用
   * Phase 4: Apply - 应用翻译到DOM
   */
  private async processVisibleTextInternal(): Promise<void> {
    const overallStart = performance.now()

    logger.group('🚀 四阶段翻译流水线')

    try {
      const config = await this.storageService.getConfig()
      const userLevel = config.userLevel

      // ==================== PHASE 1: COLLECT ====================
      const collectStart = performance.now()
      logger.info('📍 Phase 1: Collect')

      const textNodes = this.textExtractor.getVisibleChineseTextNodes()

      if (textNodes.length === 0) {
        logger.info('没有找到需要处理的中文文本')
        logger.groupEnd()
        return
      }

      const collectElapsed = performance.now() - collectStart
      logger.info(`Collect 完成: ${textNodes.length} 个节点 (${collectElapsed.toFixed(2)}ms)`)

      // ==================== PHASE 2: PLAN ====================
      const planStart = performance.now()
      logger.info('📍 Phase 2: Plan')

      const plan = this.textPlanner.createTranslationPlan(
        textNodes,
        this.translationCache,
        userLevel
      )

      // 提前应用缓存翻译
      if (plan.toApplyFromCache.length > 0) {
        this.textPlanner.applyCachedTranslations(plan)
      }

      const planElapsed = performance.now() - planStart
      logger.info(`Plan 完成 (${planElapsed.toFixed(2)}ms)`)

      // 如果所有翻译都已缓存，直接返回
      if (plan.uniqueTexts.length === 0) {
        logger.info('所有翻译已缓存，无需API调用')
        logger.groupEnd()
        return
      }

      // ==================== PHASE 3: DISPATCH ====================
      const dispatchStart = performance.now()
      logger.info('📍 Phase 3: Dispatch')

      logger.info(`发送 ${plan.uniqueTexts.length} 个唯一文本到 API`)

      // 设置API调用标志
      this.apiCallInProgress = true
      logger.debug('API调用开始，设置 apiCallInProgress = true')

      let apiResults: string[]
      try {
        apiResults = await this.apiService.processTexts(plan.uniqueTexts, userLevel)
      } finally {
        // 确保API调用完成后清除标志
        this.apiCallInProgress = false
        logger.debug('API调用完成，设置 apiCallInProgress = false')
      }

      const dispatchElapsed = performance.now() - dispatchStart
      logger.info(`Dispatch 完成: ${apiResults.length} 个结果 (${dispatchElapsed.toFixed(2)}ms)`)

      // 合并API结果
      const hashToTranslation = this.textPlanner.mergeApiResults(plan, apiResults)

      // 更新缓存
      for (const [hash, translation] of hashToTranslation) {
        this.translationCache.setByHash(hash, userLevel, translation)

        // Identity 缓存：如果译文仍包含中文，建立 identity 映射，避免循环翻译
        if (/[\u4e00-\u9fa5]/.test(translation)) {
          this.translationCache.set(translation, userLevel, translation)
        }
      }

      // ==================== PHASE 4: APPLY ====================
      const applyStart = performance.now()
      logger.info('📍 Phase 4: Apply')

      const applied = this.domReplacer.applyTranslations(
        plan.toSend,
        hashToTranslation,
        userLevel
      )

      const applyElapsed = performance.now() - applyStart
      logger.info(`Apply 完成: ${applied} 个节点 (${applyElapsed.toFixed(2)}ms)`)

      // ==================== SUMMARY ====================
      const overallElapsed = performance.now() - overallStart

      logger.info('总耗时: ' + overallElapsed.toFixed(2) + 'ms')
      logger.info(`  - Collect: ${collectElapsed.toFixed(2)}ms (${((collectElapsed / overallElapsed) * 100).toFixed(1)}%)`)
      logger.info(`  - Plan: ${planElapsed.toFixed(2)}ms (${((planElapsed / overallElapsed) * 100).toFixed(1)}%)`)
      logger.info(`  - Dispatch: ${dispatchElapsed.toFixed(2)}ms (${((dispatchElapsed / overallElapsed) * 100).toFixed(1)}%)`)
      logger.info(`  - Apply: ${applyElapsed.toFixed(2)}ms (${((applyElapsed / overallElapsed) * 100).toFixed(1)}%)`)

      logger.groupEnd()

    } catch (error) {
      logger.error('四阶段流水线执行失败:', error)
      logger.groupEnd()
      throw error
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
      apiCallInProgress: this.apiCallInProgress,
      fingerprintStats: this.fingerprintStore.getStats(),
      cacheStats: this.translationCache.getStats(),
      viewportInfo: this.viewportObserver.getViewportInfo()
    }
  }
}
