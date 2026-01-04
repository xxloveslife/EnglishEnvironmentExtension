import type { IObserver } from '../utils/types'
import { debounce } from '../utils/throttle'
import { logger } from '../utils/logger'

export class DomObserver implements IObserver {
  private eventListeners = new Map<string, Function[]>()
  private observer: MutationObserver | null = null
  private isActive = false
  private debouncedHandler: (() => void) | null = null
  
  constructor(private debounceDelay: number = 300) {
    this.debouncedHandler = debounce(() => {
      this.emit('domChange')
    }, this.debounceDelay)
  }
  
  start(): void {
    if (this.isActive) return
    
    this.isActive = true
    
    this.observer = new MutationObserver((mutations) => {
      // 过滤掉不重要的变化
      const significantMutations = mutations.filter(mutation => {
        // 只关注文本内容变化和子节点添加
        return (
          mutation.type === 'childList' ||
          (mutation.type === 'characterData' && 
           mutation.target.textContent?.trim())
        )
      })
      
      if (significantMutations.length > 0) {
        this.debouncedHandler!()
      }
    })
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    })
    
    logger.debug('DOM观察器已启动')
  }
  
  stop(): void {
    if (!this.isActive) return
    
    this.isActive = false
    
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    
    logger.debug('DOM观察器已停止')
  }
  
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }
  
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }
  
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          logger.error(`事件处理器出错 (${event}):`, error)
        }
      })
    }
  }
  
  /**
   * 手动触发DOM变化事件
   */
  trigger(): void {
    this.emit('domChange')
  }
}
