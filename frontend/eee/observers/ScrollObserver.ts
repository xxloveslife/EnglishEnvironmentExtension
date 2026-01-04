import type { IObserver } from '../utils/types'
import { throttle } from '../utils/throttle'
import { logger } from '../utils/logger'

export class ScrollObserver implements IObserver {
  private eventListeners = new Map<string, Function[]>()
  private isActive = false
  private throttledHandler: (() => void) | null = null
  
  constructor(private throttleDelay: number = 600) {
    // 使用 trailing-only 模式：只在滚动停止后触发，避免首尾双触发
    this.throttledHandler = throttle(() => {
      this.emit('scroll')
    }, this.throttleDelay, { leading: false, trailing: true })
  }
  
  start(): void {
    if (this.isActive) return
    
    this.isActive = true
    
    window.addEventListener('scroll', this.throttledHandler!, { 
      passive: true 
    })
    
    logger.debug('滚动观察器已启动')
  }
  
  stop(): void {
    if (!this.isActive) return
    
    this.isActive = false
    
    window.removeEventListener('scroll', this.throttledHandler!)
    
    logger.debug('滚动观察器已停止')
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
   * 获取当前滚动位置
   */
  getScrollPosition(): { x: number; y: number } {
    return {
      x: window.scrollX,
      y: window.scrollY
    }
  }
  
  /**
   * 检查是否在页面底部
   */
  isAtBottom(threshold: number = 100): boolean {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement
    return scrollTop + clientHeight >= scrollHeight - threshold
  }
}
