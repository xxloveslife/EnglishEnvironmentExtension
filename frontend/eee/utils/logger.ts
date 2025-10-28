// 日志工具
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel = LogLevel.INFO
  private enabled: boolean = true
  
  setLevel(level: LogLevel) {
    this.level = level
  }
  
  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }
  
  private shouldLog(level: LogLevel): boolean {
    return this.enabled && level >= this.level
  }
  
  debug(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(`🐛 [DEBUG] ${message}`, ...args)
    }
  }
  
  info(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`ℹ️ [INFO] ${message}`, ...args)
    }
  }
  
  warn(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`⚠️ [WARN] ${message}`, ...args)
    }
  }
  
  error(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`❌ [ERROR] ${message}`, ...args)
    }
  }
  
  group(title: string) {
    if (this.enabled) {
      console.group(title)
    }
  }
  
  groupEnd() {
    if (this.enabled) {
      console.groupEnd()
    }
  }
  
  table(data: any) {
    if (this.enabled) {
      console.table(data)
    }
  }
}

export const logger = new Logger()
