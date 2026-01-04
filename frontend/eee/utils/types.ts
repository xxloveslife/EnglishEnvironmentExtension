// 文本节点数据结构
export interface TextNodeData {
  id: string
  text: string
  rect: DOMRect
  path: string
  element: Element
  node: Text
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
  processTexts(texts: string[], userLevel: string): Promise<string[]>
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
  value: string
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

// ==================== 认证相关类型 ====================

// 用户信息
export interface UserInfo {
  userId: number
  userName: string
  nickName: string
  avatar?: string
  email?: string
  phonenumber?: string
}

// 认证状态
export interface AuthState {
  isLoggedIn: boolean
  token: string | null
  userInfo: UserInfo | null
}

// 登录请求
export interface LoginRequest {
  username: string
  password: string
  code?: string
  uuid?: string
}

// 验证码响应
export interface CaptchaResponse {
  code: number
  msg: string
  success: boolean
  captchaEnabled: boolean
  registerEnabled?: boolean
  img: string
  uuid: string
}

// 登录响应
export interface LoginResponse {
  code: number
  msg: string
  success: boolean
  token?: string
}

// 用户信息响应
export interface UserInfoResponse {
  code: number
  msg: string
  success: boolean
  permissions: string[]
  roles: string[]
  user: UserInfo
}

// 通用API响应
export interface ApiResponse<T = any> {
  code: number
  msg: string
  success: boolean
  data?: T
  time?: string
}

// API响应码
export enum ResponseCode {
  SUCCESS = 200,
  WARN = 601,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  ERROR = 500
}

// ==================== 架构优化新增类型 ====================

/**
 * 文本候选项
 * 扩展 TextNodeData，增加规范化和哈希信息
 */
export interface TextCandidate {
  /** 原始文本节点数据 */
  nodeData: TextNodeData
  /** Text 节点引用 */
  node: Text
  /** 父元素引用 */
  element: Element
  /** 原始文本内容 */
  rawText: string
  /** 规范化后的文本 */
  normalizedText: string
  /** 文本哈希值（FNV-1a） */
  textHash: string
  /** 缓存键（textHash:userLevel） */
  cacheKey: string
}

/**
 * 翻译计划
 * 包含缓存命中、待发送、去重等信息
 */
export interface TranslationPlan {
  /** 从缓存应用的翻译 */
  toApplyFromCache: Array<{
    candidate: TextCandidate
    translated: string
  }>
  /** 需要发送到 API 的候选项 */
  toSend: TextCandidate[]
  /** 去重后的唯一文本（发送给 API） */
  uniqueTexts: string[]
  /** 文本哈希 -> 候选项数组的映射（用于结果回写） */
  textHashMap: Map<string, TextCandidate[]>
  /** 统计信息 */
  stats: TranslationPlanStats
}

/**
 * 翻译计划统计信息
 */
export interface TranslationPlanStats {
  /** 总节点数 */
  total: number
  /** 节点指纹过滤掉的数量 */
  fingerprintFiltered: number
  /** 缓存命中数 */
  cached: number
  /** 需要 API 处理的数量 */
  toSend: number
  /** 去重后的唯一文本数 */
  unique: number
  /** 规范化影响的节点数 */
  normalized: number
  /** 批次去重节省的请求数 */
  batchDedupSaved: number
}

/**
 * 规范化配置
 */
export interface NormalizeConfig {
  /** 去除首尾空格（默认: true） */
  trim: boolean
  /** 压缩连续空白为单个空格（默认: true） */
  collapseWhitespace: boolean
  /** 去除零宽字符（默认: true） */
  removeZeroWidth: boolean
  /** 全角空格转半角（默认: true） */
  convertFullWidth: boolean
  /** 去除换行符（默认: false） */
  removeLineBreaks: boolean
}

/**
 * 过滤配置
 */
export interface FilterConfig {
  /** 启用黑名单过滤（默认: true） */
  useBlacklist: boolean
  /** 启用白名单过滤（默认: false） */
  useWhitelist: boolean
  /** 黑名单选择器数组 */
  blacklistSelectors: string[]
  /** 白名单选择器数组 */
  whitelistSelectors: string[]
  /** 排除按钮元素（默认: true） */
  excludeButtons: boolean
  /** 排除导航元素（默认: true） */
  excludeNavigation: boolean
}

/**
 * 节点指纹信息
 */
export interface NodeFingerprintInfo {
  /** 唯一指纹：textHash:userLevel:mode */
  fingerprint: string
  /** FNV-1a 文本哈希 */
  textHash: string
  /** 用户等级 */
  userLevel: string
  /** 处理模式 */
  mode: 'original' | 'translated'
  /** 处理时间戳 */
  timestamp: number
  /** 规范化后的文本 */
  normalizedText: string
}

/**
 * 节点指纹统计
 */
export interface FingerprintStats {
  /** 已标记节点总数（近似值） */
  totalMarked: number
  /** 缓存命中次数 */
  cacheHits: number
  /** 缓存未命中次数 */
  cacheMisses: number
  /** 命中率百分比 */
  hitRate: number
}
