# 智能中英词汇替换学习插件

## 📖 项目概述

基于Plasmo框架开发的浏览器插件，通过智能识别用户英文水平，将中文页面中的部分词汇转换为英文单词/短语，同时提供音标和中文原词注释，帮助用户在日常浏览中潜移默化学习英语词汇。

## 🏗️ 项目架构

### 核心设计原则
- **低耦合**：模块间依赖最小化，便于独立测试和维护
- **易维护**：单一职责原则，每个模块只负责一个功能
- **易扩展**：接口抽象，便于替换实现和添加新功能

### 分层架构

```
src/
├── core/                    # 核心业务逻辑层（独立于框架）
│   ├── TextProcessor.ts     # 文本处理器（核心控制器）
│   ├── TextExtractor.ts     # 文本提取器（单一职责：提取）
│   ├── DomReplacer.ts       # DOM替换器（单一职责：替换）
│   └── TranslationCache.ts  # 翻译缓存管理器
├── services/                # 服务层（可替换）
│   ├── ApiService.ts        # API服务接口 + 实现
│   └── StorageService.ts    # 存储服务封装
├── observers/               # 观察者层（事件监听）
│   ├── ScrollObserver.ts    # 滚动观察器
│   ├── DomObserver.ts       # DOM变化观察器
│   └── ViewportObserver.ts  # 视口观察器
├── utils/                   # 工具函数层（纯函数）
│   ├── types.ts            # 类型定义
│   ├── domHelpers.ts       # DOM辅助函数
│   ├── throttle.ts         # 节流/防抖函数
│   └── logger.ts           # 日志工具（统一console输出）
├── content.ts              # Content Script入口（组装层）
├── content.css             # 样式文件
└── popup.tsx               # 弹窗界面
```

## 🔧 核心模块详解

### 1. TextProcessor.ts - 核心控制器
**位置**: `core/TextProcessor.ts`  
**职责**: 协调所有模块工作，提供统一的启动/停止接口

**核心方法**:
```typescript
class TextProcessor {
  async start(): Promise<void>     // 启动处理器
  stop(): void                     // 停止处理器
  async processVisibleText(): Promise<void>  // 处理可见文本
}
```

**工作流程**:
1. 监听配置变化
2. 根据配置启动/停止观察器
3. 协调文本提取、API调用、DOM替换

### 2. TextExtractor.ts - 文本提取器
**位置**: `core/TextExtractor.ts`  
**职责**: 提取视口内包含中文的文本节点

**核心方法**:
```typescript
class TextExtractor {
  getVisibleChineseTextNodes(): TextNodeData[]  // 提取中文文本节点
  resetProcessedNodes(): void                   // 重置处理记录
  markNodeAsProcessed(nodeId: string): void     // 标记节点已处理
}
```

**提取逻辑**:
1. 使用 `document.createTreeWalker` 遍历DOM
2. 过滤条件：包含中文 + 可见 + 在视口内
3. 记录节点ID、文本内容、DOM路径、位置信息

### 3. DomReplacer.ts - DOM替换器
**位置**: `core/DomReplacer.ts`  
**职责**: 将翻译结果应用到DOM元素

**核心方法**:
```typescript
class DomReplacer {
  applyTranslations(textNodes: TextNodeData[], translations: TranslationResult[]): void
  applyFallbackTranslations(textNodes: TextNodeData[]): void  // 降级方案
}
```

**替换策略**:
1. 根据DOM路径精确定位元素
2. 使用正则表达式替换文本
3. 添加CSS类名和样式
4. 记录已替换元素，避免重复处理

### 4. TranslationCache.ts - 缓存管理器
**位置**: `core/TranslationCache.ts`  
**职责**: 管理翻译结果缓存，避免重复API调用

**核心方法**:
```typescript
class TranslationCache {
  get(text: string, userLevel: string): TranslationResult[] | null
  set(text: string, userLevel: string, results: TranslationResult[]): void
  clear(): void
}
```

**缓存策略**:
- LRU（最近最少使用）算法
- 基于文本内容和用户水平生成缓存键
- 自动清理过期缓存

## 🔄 工作流程

### 1. 插件启动流程
```
用户打开popup → 启用开关 → StorageService保存配置 → Content Script监听配置变化 → 启动TextProcessor
```

### 2. 文本处理流程
```
DOM解析 → 提取中文文本 → 检查缓存 → 批量发送API → 接收翻译结果 → 替换DOM内容 → 应用样式
```

### 3. 触发时机
- **页面加载时**: `onPageLoad: true`
- **用户滚动时**: `onScroll: true` (500ms节流)
- **DOM变化时**: `onDomChange: true` (300ms防抖)

## 📊 数据流

### 1. 配置数据流
```typescript
// 用户配置结构
interface UserConfig {
  enabled: boolean           // 插件是否启用
  userLevel: string          // 用户英语水平 (A1-C2)
  processingConfig: {
    onPageLoad: boolean      // 页面加载时处理
    onScroll: boolean        // 滚动时处理
    onDomChange: boolean     // DOM变化时处理
  }
}
```

### 2. 文本节点数据结构
```typescript
interface TextNodeData {
  id: string        // 唯一标识
  text: string      // 文本内容
  rect: DOMRect     // 位置信息
  path: string      // DOM路径
  element: Element  // DOM元素
}
```

### 3. 翻译结果结构
```typescript
interface TranslationResult {
  originalText: string    // 原文
  translatedText: string  // 译文
  phonetic?: string       // 音标
  chinese?: string        // 中文注释
  confidence: number      // 置信度
}
```

## 🎯 核心功能实现

### 1. 视口文本提取
**文件**: `core/TextExtractor.ts`

```typescript
// 核心提取逻辑
const walker = document.createTreeWalker(
  document.body,
  NodeFilter.SHOW_TEXT,
  {
    acceptNode: (node) => {
      // 检查是否包含中文
      if (!isChineseText(node.textContent || '')) {
        return NodeFilter.FILTER_REJECT
      }
      
      // 检查父元素是否可见
      const parent = node.parentElement
      if (!parent || !hasVisibleText(parent)) {
        return NodeFilter.FILTER_REJECT
      }
      
      // 检查是否在视口内
      if (!isElementInViewport(parent)) {
        return NodeFilter.FILTER_REJECT
      }
      
      return NodeFilter.FILTER_ACCEPT
    }
  }
)
```

### 2. 批量处理与节流
**文件**: `utils/throttle.ts`

```typescript
// 批量处理器
const batchProcessor = <T>(
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
```

### 3. DOM路径生成
**文件**: `utils/domHelpers.ts`

```typescript
export const getDomPath = (element: Element): string => {
  const path: string[] = []
  let current: Element | null = element
  
  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase()
    
    if (current.id) {
      selector += `#${current.id}`
    } else if (current.className) {
      const classes = current.className.split(' ').filter(c => c.trim())
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`
      }
    }
    
    // 添加兄弟节点索引
    const siblings = Array.from(current.parentElement?.children || [])
    const sameTagSiblings = siblings.filter(s => s.tagName === current?.tagName)
    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.indexOf(current) + 1
      selector += `:nth-of-type(${index})`
    }
    
    path.unshift(selector)
    current = current.parentElement
  }
  
  return path.join(' > ')
}
```

## 🎨 样式系统

### CSS变量设计
**文件**: `content.css`

```css
:root {
  --eee-primary-color: #3b82f6;
  --eee-primary-hover: #1d4ed8;
  --eee-background-hover: #dbeafe;
  --eee-border-color: #93c5fd;
  --eee-text-color: #1e293b;
  --eee-phonetic-color: #64748b;
  --eee-chinese-color: #6b7280;
}
```

### 翻译词汇样式
```css
.eee-translated-word {
  position: relative;
  display: inline-block;
  cursor: pointer;
  color: var(--eee-primary-color);
  font-weight: 500;
  border-bottom: 1px dashed var(--eee-border-color);
  transition: var(--eee-transition);
}
```

## 🔍 调试与监控

### 1. 日志系统
**文件**: `utils/logger.ts`

```typescript
class Logger {
  debug(message: string, ...args: any[])
  info(message: string, ...args: any[])
  warn(message: string, ...args: any[])
  error(message: string, ...args: any[])
  group(title: string)
  groupEnd()
  table(data: any)
}
```

### 2. 调试接口
**文件**: `content.ts`

```typescript
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
}
```

### 3. 性能监控
```typescript
getStatus() {
  return {
    isProcessing: this.isProcessing,
    processedNodes: this.textExtractor.getProcessedCount(),
    replacedElements: this.domReplacer.getReplacedCount(),
    cacheStats: this.translationCache.getStats(),
    viewportInfo: this.viewportObserver.getViewportInfo()
  }
}
```

## 🚀 开发指南

### 1. 本地开发
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 打包发布
pnpm package
```

### 2. 调试步骤
1. 在Chrome中加载 `build/chrome-mv3-dev` 文件夹
2. 打开popup界面，启用插件
3. 访问包含中文的网页
4. 按F12打开开发者工具，查看Console标签
5. 观察详细的处理日志

### 3. 常见问题排查
- **插件未工作**: 检查Console是否有初始化错误
- **翻译不生效**: 查看是否有文本提取和处理日志
- **性能问题**: 观察处理节点数量和缓存命中率

## 📈 性能优化

### 1. 视口聚焦
- 只处理当前视口可见内容
- 避免处理不可见区域的文本

### 2. 批量处理
- 将视口中文文本收集成集合发送
- 减少API调用次数

### 3. 智能缓存
- LRU缓存策略
- 避免重复处理相同文本

### 4. 节流控制
- 滚动事件500ms节流
- DOM变化300ms防抖

## 🔮 扩展方向

### 1. 功能扩展
- 支持更多语言对
- 添加词汇学习进度跟踪
- 实现个性化学习推荐

### 2. 性能优化
- 使用Web Workers处理大量文本
- 实现更智能的缓存策略
- 优化DOM操作性能

### 3. 用户体验
- 添加更多样式主题
- 支持用户自定义翻译规则
- 实现离线翻译功能

## 📝 维护指南

### 1. 代码结构
- 遵循单一职责原则
- 保持模块间低耦合
- 使用TypeScript确保类型安全

### 2. 测试策略
- 单元测试：测试工具函数
- 集成测试：测试模块协作
- 端到端测试：测试完整流程

### 3. 部署流程
- 使用GitHub Actions自动化构建
- 使用Plasmo BPP自动发布到应用商店
- 版本管理和回滚策略

---

**最后更新**: 2024年12月
**维护者**: xxloveslife
**项目地址**: [GitHub Repository]
