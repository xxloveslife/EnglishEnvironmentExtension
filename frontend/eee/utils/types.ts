// 文本节点数据结构
export interface TextNodeData {
  id: string
  text: string
  rect: DOMRect
  path: string
  element: Element
}

// 翻译结果
export interface TranslationResult {
  originalText: string
  translatedText: string
  phonetic?: string
  chinese?: string
  confidence: number
}

// 用户配置
export interface UserConfig {
  enabled: boolean
  userLevel: string
  processingConfig: {
    onPageLoad: boolean
    onScroll: boolean
    onDomChange: boolean
  }
}

// API服务接口
export interface IApiService {
  processTexts(texts: string[], userLevel: string): Promise<TranslationResult[]>
}

// 存储服务接口
export interface IStorageService {
  getConfig(): Promise<UserConfig>
  setConfig(config: Partial<UserConfig>): Promise<void>
  watchConfig(callback: (config: UserConfig) => void): () => void
}

// 文本处理器接口
export interface ITextProcessor {
  start(): void
  stop(): void
  processVisibleText(): Promise<void>
}

// 观察者接口
export interface IObserver {
  start(): void
  stop(): void
  on(event: string, callback: Function): void
  off(event: string, callback: Function): void
}

// 缓存项
export interface CacheItem {
  key: string
  value: TranslationResult[]
  timestamp: number
  accessCount: number
}

// 英语水平枚举
export enum EnglishLevel {
  A1 = 'A1',
  A2 = 'A2', 
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2'
}

// 处理配置
export interface ProcessingConfig {
  throttleDelay: number
  batchDelay: number
  maxCacheSize: number
  viewportMargin: number
}
