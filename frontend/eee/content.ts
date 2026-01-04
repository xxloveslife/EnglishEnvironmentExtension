import type { PlasmoCSConfig } from "plasmo"
import { MockApiService, BackgroundApiService } from "./services/ApiService"
import { StorageService } from "./services/StorageService"
import { TextProcessor } from "./core/TextProcessor"
import { logger } from "./utils/logger"
import type { IApiService } from "./utils/types"

// Plasmo配置
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
  run_at: "document_end"
}

// 全局变量
let textProcessor: TextProcessor | null = null
let isInitialized = false
let storageService: StorageService | null = null

// 是否使用真实API（设置为true后需要登录才能使用）
const USE_REAL_API = true

// 初始化函数
const initializeExtension = async () => {
  if (isInitialized) {
    logger.warn('扩展已经初始化，跳过重复初始化')
    return
  }

  try {
    logger.group('初始化英语学习扩展')

    // 创建存储服务
    storageService = new StorageService()

    // 检查登录状态
    if (USE_REAL_API) {
      const isLoggedIn = await storageService.isLoggedIn()
      if (!isLoggedIn) {
        logger.info('用户未登录，扩展功能暂不可用')
        logger.groupEnd()
        // 设置监听，等待用户登录
        setupAuthWatcher()
        return
      }
    }

    // 创建API服务
    let apiService: IApiService
    if (USE_REAL_API) {
      // 使用 background 代发 API（避免页面 CORS）
      apiService = new BackgroundApiService()
      logger.info('使用真实API服务')
    } else {
      // 使用模拟API服务
      apiService = new MockApiService()
      logger.info('使用模拟API服务')
    }

    // 创建文本处理器
    textProcessor = new TextProcessor(apiService, storageService)

    // 启动处理器
    await textProcessor.start()

    isInitialized = true
    logger.info('扩展初始化成功')
    logger.groupEnd()

  } catch (error) {
    logger.error('扩展初始化失败:', error)
  }
}

// 设置认证状态监听
const setupAuthWatcher = () => {
  if (!storageService) {
    storageService = new StorageService()
  }

  const unsubscribe = storageService.watchAuthState(async (authState) => {
    if (authState.isLoggedIn && authState.token) {
      logger.info('检测到用户登录，开始初始化扩展')
      unsubscribe()
      await initializeExtension()
    }
  })
}

// 清理函数
const cleanup = () => {
  if (textProcessor) {
    textProcessor.stop()
    textProcessor = null
  }
  isInitialized = false
  logger.info('扩展已清理')
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension)
} else {
  initializeExtension()
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup)

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !isInitialized) {
    initializeExtension()
  } else if (document.visibilityState === 'hidden') {
    cleanup()
  }
})

// 监听认证状态变化（用于登出时停止）
if (storageService) {
  storageService.watchAuthState((authState) => {
    if (!authState.isLoggedIn && isInitialized) {
      logger.info('检测到用户登出，停止扩展')
      cleanup()
    }
  })
}

// 开发模式下暴露调试接口
if (process.env.NODE_ENV === 'development') {
  (window as any).eeeDebug = {
    getProcessor: () => textProcessor,
    getStatus: () => textProcessor?.getStatus(),
    restart: () => {
      cleanup()
      setTimeout(initializeExtension, 100)
    },
    getAuthState: async () => {
      if (storageService) {
        return await storageService.getAuthState()
      }
      return null
    },
    logger
  }

  logger.info('调试接口已暴露到 window.eeeDebug')
}
