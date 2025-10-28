import type { PlasmoCSConfig } from "plasmo"
import { MockApiService } from "./services/ApiService"
import { StorageService } from "./services/StorageService"
import { TextProcessor } from "./core/TextProcessor"
import { logger } from "./utils/logger"

// Plasmo配置
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
  run_at: "document_end"
}

// 全局变量
let textProcessor: TextProcessor | null = null
let isInitialized = false

// 初始化函数
const initializeExtension = async () => {
  if (isInitialized) {
    logger.warn('扩展已经初始化，跳过重复初始化')
    return
  }
  
  try {
    logger.group('🔧 初始化英语学习扩展')
    
    // 创建服务实例
    const apiService = new MockApiService()
    const storageService = new StorageService()
    
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

// 开发模式下暴露调试接口
if (process.env.NODE_ENV === 'development') {
  (window as any).eeeDebug = {
    getProcessor: () => textProcessor,
    getStatus: () => textProcessor?.getStatus(),
    restart: () => {
      cleanup()
      setTimeout(initializeExtension, 100)
    },
    logger
  }
  
  logger.info('调试接口已暴露到 window.eeeDebug')
}
