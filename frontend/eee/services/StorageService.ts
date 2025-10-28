import { Storage } from '@plasmohq/storage'
import { IStorageService, UserConfig, EnglishLevel } from '../utils/types'
import { logger } from '../utils/logger'

export class StorageService implements IStorageService {
  private storage: Storage
  private configKey = 'userConfig'
  
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
        // 返回默认配置
        const defaultConfig: UserConfig = {
          enabled: false,
          userLevel: EnglishLevel.B1,
          processingConfig: {
            onPageLoad: true,
            onScroll: true,
            onDomChange: false
          }
        }
        
        await this.setConfig(defaultConfig)
        return defaultConfig
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
      const currentConfig = await this.getConfig()
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
    const unsubscribe = this.storage.watch({
      [this.configKey]: (c) => {
        if (c.newValue) {
          callback(c.newValue)
        }
      }
    })
    
    return unsubscribe
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
}
