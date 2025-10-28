import { IApiService, TranslationResult, EnglishLevel } from '../utils/types'
import { logger } from '../utils/logger'

export class MockApiService implements IApiService {
  /**
   * 模拟API调用，返回假数据用于测试
   */
  async processTexts(texts: string[], userLevel: string): Promise<TranslationResult[]> {
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
    
    // 生成模拟翻译结果
    const results: TranslationResult[] = validTexts.map(text => {
      const mockTranslations = this.generateMockTranslation(text, userLevel)
      return mockTranslations
    })
    
    logger.group('📥 接收处理结果（模拟）')
    logger.table(results.map((result, index) => ({
      索引: index,
      原文: result.originalText.substring(0, 20) + '...',
      译文: result.translatedText,
      音标: result.phonetic || 'N/A',
      置信度: result.confidence
    })))
    logger.groupEnd()
    
    return results
  }
  
  /**
   * 生成模拟翻译结果
   */
  private generateMockTranslation(text: string, userLevel: string): TranslationResult {
    // 简单的模拟翻译映射
    const mockMap: Record<string, TranslationResult> = {
      '厉害': {
        originalText: '厉害',
        translatedText: 'awesome',
        phonetic: 'ˈɔːsəm',
        chinese: '厉害',
        confidence: 0.95
      },
      '漂亮': {
        originalText: '漂亮',
        translatedText: 'beautiful',
        phonetic: 'ˈbjuːtɪfl',
        chinese: '漂亮',
        confidence: 0.92
      },
      '聪明': {
        originalText: '聪明',
        translatedText: 'smart',
        phonetic: 'smɑːt',
        chinese: '聪明',
        confidence: 0.88
      },
      '快乐': {
        originalText: '快乐',
        translatedText: 'happy',
        phonetic: 'ˈhæpi',
        chinese: '快乐',
        confidence: 0.90
      },
      '美丽': {
        originalText: '美丽',
        translatedText: 'beautiful',
        phonetic: 'ˈbjuːtɪfl',
        chinese: '美丽',
        confidence: 0.89
      }
    }
    
    // 查找匹配的翻译
    for (const [chinese, translation] of Object.entries(mockMap)) {
      if (text.includes(chinese)) {
        return translation
      }
    }
    
    // 如果没有匹配的，返回一个通用的翻译
    return {
      originalText: text.substring(0, 10),
      translatedText: 'example',
      phonetic: 'ɪɡˈzɑːmpl',
      chinese: text.substring(0, 10),
      confidence: 0.75
    }
  }
}

export class RealApiService implements IApiService {
  private apiEndpoint: string
  
  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint
  }
  
  /**
   * 真实API调用（未来实现）
   */
  async processTexts(texts: string[], userLevel: string): Promise<TranslationResult[]> {
    try {
      const response = await fetch(`${this.apiEndpoint}/process-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts,
          userLevel,
          timestamp: Date.now()
        })
      })
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }
      
      const results = await response.json()
      return results.translations || []
      
    } catch (error) {
      logger.error('API调用失败:', error)
      throw error
    }
  }
}
