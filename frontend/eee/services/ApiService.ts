import { ResponseCode } from '../utils/types'
import type {
  IApiService,
  LoginRequest,
  LoginResponse,
  CaptchaResponse,
  UserInfoResponse,
  ApiResponse
} from '../utils/types'
import { logger } from '../utils/logger'
import { StorageService } from './StorageService'

// API客户端配置
interface ApiClientConfig {
  baseUrl: string
  timeout?: number
}

/**
 * 统一的API客户端
 * 封装所有HTTP请求，自动处理认证token
 */
export class ApiClient {
  private baseUrl: string
  private timeout: number
  private storageService: StorageService

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // 移除末尾斜杠
    this.timeout = config.timeout || 30000
    this.storageService = new StorageService()
  }

  /**
   * 通用请求方法
   */
  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.storageService.getToken()

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {})
    }

    // 自动添加认证头
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // 如果不是FormData，默认添加JSON content-type
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        headers,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      // 处理401未授权错误
      if (data.code === ResponseCode.UNAUTHORIZED) {
        logger.warn('Token已过期，需要重新登录')
        await this.storageService.clearAuth()
        throw new Error('登录已过期，请重新登录')
      }

      return data
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时')
      }

      throw error
    }
  }

  /**
   * GET请求
   */
  async get<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'GET' })
  }

  /**
   * POST请求（JSON格式）
   */
  async post<T>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  /**
   * POST请求（FormData格式）
   */
  async postForm<T>(url: string, data: Record<string, string>): Promise<T> {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value)
    })

    return this.request<T>(url, {
      method: 'POST',
      body: formData
    })
  }

  // ==================== 认证相关接口 ====================

  /**
   * 获取验证码
   */
  async getCaptcha(): Promise<CaptchaResponse> {
    return this.get<CaptchaResponse>('/captchaImage')
  }

  /**
   * 登录
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const formData: Record<string, string> = {
      username: data.username,
      password: data.password
    }

    if (data.code) {
      formData.code = data.code
    }
    if (data.uuid) {
      formData.uuid = data.uuid
    }

    const response = await this.postForm<LoginResponse>('/login', formData)

    // 登录成功后保存token
    if (response.success && response.token) {
      await this.storageService.setToken(response.token)

      // 获取用户信息
      try {
        const userInfo = await this.getUserInfo()
        if (userInfo.success && userInfo.user) {
          await this.storageService.setUserInfo(userInfo.user)
        }
      } catch (error) {
        logger.warn('获取用户信息失败:', error)
      }
    }

    return response
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(): Promise<UserInfoResponse> {
    return this.get<UserInfoResponse>('/getInfo')
  }

  /**
   * 退出登录
   */
  async logout(): Promise<ApiResponse> {
    try {
      const response = await this.post<ApiResponse>('/logout')

      // 清除本地认证状态
      await this.storageService.clearAuth()

      return response
    } catch (error) {
      // 即使请求失败也清除本地状态
      await this.storageService.clearAuth()
      throw error
    }
  }

  // ==================== 业务接口 ====================

  /**
   * 处理文本翻译
   */
  async processTexts(texts: string[], userLevel: string): Promise<string[]> {
    try {
      const response = await this.post<ApiResponse<string[]>>('/trans', {
        texts,
        userLevel,
        timestamp: Date.now()
      })

      if (response.success && response.data) {
        return response.data
      }

      throw new Error(response.msg || '翻译请求失败')
    } catch (error) {
      logger.error('翻译API调用失败:', error)
      throw error
    }
  }
}

// ==================== 兼容旧版API服务 ====================

export class MockApiService implements IApiService {
  /**
   * 模拟API调用，返回假数据用于测试
   */
  async processTexts(texts: string[], userLevel: string): Promise<string[]> {
    logger.group('📤 发送文本处理请求')
    logger.info('文本数量:', texts.length)
    logger.info('用户水平:', userLevel)

    // 过滤空值和无效文本
    const validTexts = texts.filter(text => text && typeof text === 'string' && text.trim().length > 0)
    logger.info('有效文本数量:', validTexts.length)

    if (validTexts.length === 0) {
      logger.warn('没有有效的文本需要处理')
      logger.groupEnd()
      return []
    }

    // 显示详细的文本信息
    logger.table(validTexts.map((text, index) => ({
      索引: index,
      文本内容: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      完整长度: text.length,
      包含中文: /[\u4e00-\u9fa5]/.test(text),
      首尾字符: `"${text.charAt(0)}...${text.charAt(text.length - 1)}"`
    })))

    // 显示原始文本（用于调试）
    logger.info('原始文本列表:')
    validTexts.forEach((text, index) => {
      logger.info(`${index + 1}. "${text}"`)
    })

    logger.groupEnd()

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

    // 生成模拟翻译结果（最小版本：直接返回字符串）
    const results: string[] = validTexts.map(text => this.generateMockTranslation(text, userLevel))

    logger.group('📥 接收处理结果（模拟）')
    logger.table(results.map((result, index) => ({
      索引: index,
      译文: result.substring(0, 60) + (result.length > 60 ? '...' : '')
    })))
    logger.groupEnd()

    return results
  }

  /**
   * 生成模拟翻译结果
   */
  private generateMockTranslation(text: string, _userLevel: string): string {
    const mockMap: Record<string, string> = {
      '厉害': 'awesome',
      '漂亮': 'beautiful',
      '聪明': 'smart',
      '快乐': 'happy',
      '美丽': 'beautiful'
    }

    // 查找匹配的翻译
    for (const [chinese, translation] of Object.entries(mockMap)) {
      if (text.includes(chinese)) {
        return translation
      }
    }

    // 如果没有匹配的，返回一个通用的翻译
    return text
  }
}

export class RealApiService implements IApiService {
  private apiClient: ApiClient

  constructor(apiEndpoint: string) {
    this.apiClient = new ApiClient({ baseUrl: apiEndpoint })
  }

  /**
   * 真实API调用
   */
  async processTexts(texts: string[], userLevel: string): Promise<string[]> {
    return this.apiClient.processTexts(texts, userLevel)
  }
}

/**
 * 通过 background 代发请求，避免 content script 在页面域名下触发 CORS。
 */
export class BackgroundApiService implements IApiService {
  async processTexts(texts: string[], userLevel: string): Promise<string[]> {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      throw new Error("当前环境不支持 background 消息调用")
    }

    const resp = await chrome.runtime.sendMessage({
      type: "EEE_PROCESS_TEXTS",
      payload: { texts, userLevel }
    })

    if (resp?.ok) {
      return resp.data as string[]
    }

    throw new Error(resp?.error || "翻译请求失败")
  }
}

// 导出API客户端单例
// TODO: 从配置中读取baseUrl
export const apiClient = new ApiClient({
  baseUrl: 'http://127.0.0.1:9099' // 开发环境地址，可根据需要修改
})
