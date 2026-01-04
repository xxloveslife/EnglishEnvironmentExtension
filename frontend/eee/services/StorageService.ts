import { Storage } from '@plasmohq/storage'
import { EnglishLevel } from '../utils/types'
import type { IStorageService, UserConfig, AuthState, UserInfo } from '../utils/types'
import { logger } from '../utils/logger'

export class StorageService implements IStorageService {
  private storage: Storage
  private configKey = 'userConfig'
  private authKey = 'authState'
  private defaultConfig: UserConfig = {
    enabled: false,
    userLevel: EnglishLevel.B1,
    processingConfig: {
      onPageLoad: true,
      onScroll: true,
      onDomChange: false
    }
  }
  
  constructor() {
    this.storage = new Storage({
      area: 'local'
    })
  }
  
  /**
   * 获取用户配置
   */
  async getConfig(): Promise<UserConfig> {
    try {
      const config = await this.storage.get<UserConfig>(this.configKey)
      
      if (!config) {
        // 首次使用：写入默认配置（避免 getConfig <-> setConfig 递归）
        await this.storage.set(this.configKey, this.defaultConfig)
        return this.defaultConfig
      }
      
      return config
      
    } catch (error) {
      logger.error('获取配置失败:', error)
      throw error
    }
  }
  
  /**
   * 设置用户配置
   */
  async setConfig(config: Partial<UserConfig>): Promise<void> {
    try {
      const currentConfig = (await this.storage.get<UserConfig>(this.configKey)) ?? this.defaultConfig
      const newConfig = { ...currentConfig, ...config }
      
      await this.storage.set(this.configKey, newConfig)
      logger.debug('配置已更新:', newConfig)
      
    } catch (error) {
      logger.error('设置配置失败:', error)
      throw error
    }
  }
  
  /**
   * 监听配置变化
   */
  watchConfig(callback: (config: UserConfig) => void): () => void {
    const callbackMap = {
      [this.configKey]: (c) => {
        if (c.newValue) {
          callback(c.newValue)
        }
      }
    }

    this.storage.watch(callbackMap)

    return () => {
      this.storage.unwatch(callbackMap)
    }
  }
  
  /**
   * 获取特定配置项
   */
  async getConfigValue<K extends keyof UserConfig>(key: K): Promise<UserConfig[K]> {
    const config = await this.getConfig()
    return config[key]
  }
  
  /**
   * 设置特定配置项
   */
  async setConfigValue<K extends keyof UserConfig>(
    key: K, 
    value: UserConfig[K]
  ): Promise<void> {
    await this.setConfig({ [key]: value } as Partial<UserConfig>)
  }
  
  /**
   * 重置配置为默认值
   */
  async resetConfig(): Promise<void> {
    const defaultConfig: UserConfig = {
      enabled: false,
      userLevel: EnglishLevel.B1,
      processingConfig: {
        onPageLoad: true,
        onScroll: true,
        onDomChange: false
      }
    }

    await this.storage.set(this.configKey, defaultConfig)
    logger.info('配置已重置为默认值')
  }

  // ==================== 认证相关方法 ====================

  /**
   * 获取认证状态
   */
  async getAuthState(): Promise<AuthState> {
    try {
      const authState = await this.storage.get<AuthState>(this.authKey)

      if (!authState) {
        const defaultAuthState: AuthState = {
          isLoggedIn: false,
          token: null,
          userInfo: null
        }
        return defaultAuthState
      }

      return authState
    } catch (error) {
      logger.error('获取认证状态失败:', error)
      return {
        isLoggedIn: false,
        token: null,
        userInfo: null
      }
    }
  }

  /**
   * 设置认证状态
   */
  async setAuthState(state: Partial<AuthState>): Promise<void> {
    try {
      const currentState = await this.getAuthState()
      const newState = { ...currentState, ...state }

      await this.storage.set(this.authKey, newState)
      logger.debug('认证状态已更新:', newState)
    } catch (error) {
      logger.error('设置认证状态失败:', error)
      throw error
    }
  }

  /**
   * 设置Token
   */
  async setToken(token: string): Promise<void> {
    await this.setAuthState({ token, isLoggedIn: true })
  }

  /**
   * 获取Token
   */
  async getToken(): Promise<string | null> {
    const authState = await this.getAuthState()
    return authState.token
  }

  /**
   * 设置用户信息
   */
  async setUserInfo(userInfo: UserInfo): Promise<void> {
    await this.setAuthState({ userInfo })
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(): Promise<UserInfo | null> {
    const authState = await this.getAuthState()
    return authState.userInfo
  }

  /**
   * 清除认证状态（退出登录）
   */
  async clearAuth(): Promise<void> {
    const defaultAuthState: AuthState = {
      isLoggedIn: false,
      token: null,
      userInfo: null
    }

    await this.storage.set(this.authKey, defaultAuthState)
    logger.info('认证状态已清除')
  }

  /**
   * 监听认证状态变化
   */
  watchAuthState(callback: (authState: AuthState) => void): () => void {
    const callbackMap = {
      [this.authKey]: (c) => {
        if (c.newValue) {
          callback(c.newValue)
        }
      }
    }

    this.storage.watch(callbackMap)

    return () => {
      this.storage.unwatch(callbackMap)
    }
  }

  /**
   * 检查是否已登录
   */
  async isLoggedIn(): Promise<boolean> {
    const authState = await this.getAuthState()
    return authState.isLoggedIn && !!authState.token
  }
}
