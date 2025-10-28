import { IObserver } from '../utils/types'
import { logger } from '../utils/logger'

export class ViewportObserver implements IObserver {
  private eventListeners = new Map<string, Function[]>()
  private observer: IntersectionObserver | null = null
  private isActive = false
  private observedElements = new Set<Element>()
  
  constructor(
    private rootMargin: string = '0px',
    private threshold: number = 0.1
  ) {}
  
  start(): void {
    if (this.isActive) return
    
    this.isActive = true
    
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.emit('elementEnter', entry.target)
          } else {
            this.emit('elementLeave', entry.target)
          }
        })
      },
      {
        rootMargin: this.rootMargin,
        threshold: this.threshold
      }
    )
    
    logger.debug('视口观察器已启动')
  }
  
  stop(): void {
    if (!this.isActive) return
    
    this.isActive = false
    
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    
    this.observedElements.clear()
    logger.debug('视口观察器已停止')
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
   * 观察元素
   */
  observe(element: Element): void {
    if (!this.observer || this.observedElements.has(element)) {
      return
    }
    
    this.observer.observe(element)
    this.observedElements.add(element)
  }
  
  /**
   * 停止观察元素
   */
  unobserve(element: Element): void {
    if (!this.observer || !this.observedElements.has(element)) {
      return
    }
    
    this.observer.unobserve(element)
    this.observedElements.delete(element)
  }
  
  /**
   * 获取视口信息
   */
  getViewportInfo() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      observedCount: this.observedElements.size
    }
  }
  
  /**
   * 检查元素是否在视口内
   */
  isElementInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect()
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    )
  }
}
