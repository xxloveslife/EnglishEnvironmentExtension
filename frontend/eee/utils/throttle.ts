// 节流函数配置选项
export interface ThrottleOptions {
  leading?: boolean   // 是否在首次触发时立即执行（默认: true）
  trailing?: boolean  // 是否在停止触发后延迟执行（默认: true）
}

// 节流函数
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: ThrottleOptions = {}
): ((...args: Parameters<T>) => void) => {
  const { leading = true, trailing = true } = options

  let timeoutId: NodeJS.Timeout | null = null
  let lastExecTime = 0
  let lastArgs: Parameters<T> | null = null

  return (...args: Parameters<T>) => {
    const currentTime = Date.now()
    const timeSinceLastExec = currentTime - lastExecTime

    // 清除之前的延迟定时器
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    // Leading edge: 首次触发或距离上次执行超过 delay 时立即执行
    if (leading && timeSinceLastExec > delay) {
      func(...args)
      lastExecTime = currentTime
      lastArgs = null
      return
    }

    // 保存参数用于可能的 trailing 调用
    lastArgs = args

    // Trailing edge: 在停止触发后延迟执行
    if (trailing) {
      const remainingTime = Math.max(0, delay - timeSinceLastExec)
      timeoutId = setTimeout(() => {
        func(...(lastArgs as Parameters<T>))
        lastExecTime = Date.now()
        lastArgs = null
        timeoutId = null
      }, remainingTime)
    }
  }
}

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

// 批量处理函数
export const batchProcessor = <T>(
  processor: (items: T[]) => void,
  delay: number = 200
) => {
  let items: T[] = []
  let timeoutId: NodeJS.Timeout | null = null
  
  return (item: T) => {
    items.push(item)
    
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      processor([...items])
      items = []
    }, delay)
  }
}




