# EnglishEnvironmentExtension 翻译替换架构优化设计（最优完整版）

> 目标：为“页面文本收集 → 后台大模型处理 → 回写替换页面文本”的核心链路提供**最稳、最省资源、可扩展**的整体方案。  
> 本文面向后续重构与长期演进，不局限于最小改动。

---

## 1. 背景与核心诉求

你当前产品的核心能力是：

- **采集**：在页面中收集“带文字”的节点（不希望以“是否中文”作为触发条件）。
- **处理**：批量发送到后端（大模型）做改写/翻译/润色等，后端返回 `string[]`（与请求顺序对齐）。
- **替换**：把返回的结果写回页面，形成“页面实时被改写”的效果。
- **幂等**：**已处理过的内容不要重复处理**（减少资源浪费），只有“新增/变化”才处理。

现实约束（必须同时满足）：

- **SPA/重渲染**：知乎等站点频繁重渲染，Text 节点会被销毁并重建，DOM path 不稳定。
- **滚动/视口**：需要在滚动时增量处理新内容，但不能重复请求。
- **跨域/权限**：content script 在页面域名下会受 CORS 影响；需要 background 代发。
- **性能预算**：不应因频繁扫描/替换导致页面卡顿。

---

## 2. 当前实现的典型问题（归因）

### 2.1 “是否中文”的采集条件会导致策略错误
如果以中文作为“需要处理”的判定：
- 后端返回“夹杂英文”的混合文本仍包含中文 → 被再次采集 → 再次发送 → 资源浪费/循环处理。

### 2.2 只做“文本级缓存”或只做“节点级 processed”都不够
- **只做节点级**：SPA 重渲染后节点变了，processed 失效，还是会重复发。
- **只做文本级**：动态文本（计数、时间）每次都不一样，缓存命中率低；而且无法避免同一节点重复入队。

### 2.3 innerHTML replace 天生不稳
`innerHTML.replace(...)` 会在以下场景大量失败：
- 文本被拆分到多个子节点/标签中
- `&nbsp;`、换行、零宽字符等导致不匹配
最佳实践是：**优先对 Text 节点本身写回 `textContent`**。

---

## 3. 最优架构（推荐最终形态）

### 3.1 三层幂等/去重体系（核心）

> 不依赖“中文/英文”，只依赖“节点身份 + 文本指纹 + 全局缓存”。

#### A) 节点指纹（Node Fingerprint / WeakMap）
对每个 Text 节点维护“最近一次处理的 fingerprint”：
- `fingerprint = hash(normalize(textContent)) + ":" + userLevel + ":" + mode`
- 存储结构：`WeakMap<Text, string>`
- 规则：如果当前 fingerprint 与 WeakMap 中一致 → **跳过**（同节点同文本不重复）

优点：
- 滚动/重复扫描不会重复入队
- 节点被销毁后 WeakMap 自动释放，不泄漏

#### B) 文本缓存（Text Cache / LRU）
对“文本内容”做跨节点缓存：
- key：`hash(normalize(text)) + ":" + userLevel + ":" + mode`
- value：`translatedText`（或 future：tokens）
- 用 LRU + TTL（可选）

优点：
- 同样的文本出现在多个位置/重渲染后仍能命中，不重复请求

#### C) 批次去重（Batch Dedup）
对本轮准备发送到后台的集合去重：
- `uniqueTexts = uniqBy(hash(normalize(text)))`

优点：
- 同一屏里重复 UI 文本（“分享/收藏/阅读全文”）不会重复发送

> 最终效果：同节点不重复，同文本不重复，同批次不重复。

---

### 3.2 “采集 → 计划 → 调度 → 回写”的流水线

建议将逻辑拆为 4 个阶段，各自职责单一：

1) **Collect（采集）**：扫描视口内 Text 节点，输出 `TextCandidate[]`
2) **Plan（计划）**：对候选做过滤、去重、缓存命中判断，生成 `TranslationPlan`
3) **Dispatch（调度）**：批量向 background 发送请求，得到 `translated[]`
4) **Apply（回写）**：直接写回 Text 节点（`textNode.textContent = translated`），并更新 nodeFingerprint 与缓存

这样可以将“策略（过滤/幂等/缓存）”与“工程（消息/网络）”分离，便于长期演进。

---

## 4. 关键数据结构（建议）

### 4.1 TextCandidate（候选）

- `node: Text`：真实 Text 节点引用（优先）
- `rawText: string`：采集瞬间文本
- `normalizedText: string`：规范化后的文本
- `textHash: string`：hash(normalizedText)
- `nodeFingerprint: string`：textHash + userLevel + mode
- `rect / visibility`：可选，用于视口策略

### 4.2 TranslationPlan（计划）

- `toApplyFromCache: Array<{ candidate, translated }>`
- `toSend: Array<{ candidate }>`（未命中缓存）
- `uniqueTexts: string[]`（去重后的请求 payload）
- `mapping: Map<textHash, translatedIndex>`（返回后映射回每个 candidate）

### 4.3 缓存与幂等存储

- `WeakMap<Text, string> nodeFingerprintMap`
- `LRUCache<string /*textKey*/, string /*translated*/>`
- （可选）`Set<string> recentlySent`：短窗口抖动去重（如 1~3 秒）

---

## 5. 过滤与 normalize（决定资源消耗上限）

### 5.1 normalize 推荐规则

目标：提高缓存命中率，避免“空格/零宽字符/换行差异”导致重复请求。

建议 normalize 做：
- `trim()`
- 将连续空白（包括换行/制表）压缩为单个空格：`/\s+/g -> " "`
- 去掉零宽字符：`/[\u200B-\u200D\uFEFF]/g`
- 可选：把全角空格转半角

### 5.2 shouldProcess 过滤规则（不依赖中文）

建议按“价值”过滤，减少噪音：
- 空/纯空白：跳过
- 太短：比如 `< 2` 跳过（或 `< 4`）
- 纯标点/emoji：跳过
- 纯数字或短数字计数：跳过（如 “298”、“55 条评论” 也可按规则跳过）
- 特定容器过滤（推荐）：
  - 只处理主内容容器（知乎可基于选择器定位文章/回答正文）
  - 或排除 header/nav/button/aria-role=button 等区域

> 过滤策略应可配置化（后续可做白名单/黑名单）。

---

## 6. 调度与性能预算（必须）

### 6.1 扫描频率
- 滚动触发：节流 300~800ms（你现在 500ms ok）
- DOM mutation：防抖 300~800ms（按站点复杂度调）

### 6.2 批量策略（强烈建议）
- 每次最多处理 N 个候选（例如 30~80）
- 每次 payload 总字符数上限（例如 5k~20k）
- 超过则分批（避免请求太大、延迟太长、失败成本高）

### 6.3 只处理“视口附近”
视口策略建议：
- 仅处理 viewport + margin（比如上下各 800px）
- 避免一次把整页都扫完导致性能崩

---

## 7. Background 代发与消息协议（方案A最佳实践）

### 7.1 为什么要 background
content script 受页面 Origin 影响，会遇到 CORS；background/service worker 在扩展权限下可直接访问你的后端。

### 7.2 消息协议建议（带 requestId）

- 请求：
  - `type: "EEE_PROCESS_TEXTS"`
  - `payload: { requestId, userLevel, mode, texts: string[] }`
- 响应：
  - `ok: true, requestId, data: string[]`
  - `ok: false, requestId, error, code?`

requestId 用于：
- 避免并发/过期响应回写到新页面状态（“旧请求覆盖新节点”）

### 7.3 bfcache / message channel closed
在浏览器 back/forward cache 场景，会出现：
`Unchecked runtime.lastError: ... message channel is closed`

建议：
- content 侧封装 sendMessage，捕获 lastError，必要时做一次“延迟重试”或“忽略本次批次”。
- 监听页面 `pageshow`：
  - `if (event.persisted) restartPipeline()`

---

## 8. 回写策略（强烈推荐只写 Text 节点）

最稳的回写方式：
- `textNode.textContent = translated`
- 仅当 `textNode.isConnected` 为 true 才写（避免写到已销毁节点）
- 写成功后更新：
  - `nodeFingerprintMap.set(textNode, newFingerprint)`
  - `textCache.set(textKey, translated)`

> 词级别富文本替换（span/音标）属于后续阶段2，当前最优方案以“整段替换”优先保证稳定性。

---

## 9. 端到端算法（伪代码）

```ts
collectCandidates(): Text[] // 只负责采集 Text 节点

pipelineTick():
  texts = collectCandidates()
  candidates = texts
    .map(t => ({
      node: t,
      raw: t.textContent ?? "",
      normalized: normalize(raw),
      hash: hash(normalized),
      fingerprint: `${hash}:${userLevel}:${mode}`
    }))
    .filter(c => shouldProcess(c))
    .filter(c => nodeFingerprintMap.get(c.node) !== c.fingerprint) // 节点级幂等

  // cache hit
  toApply = []
  toSend = []
  for c in candidates:
    key = `${c.hash}:${userLevel}:${mode}`
    cached = textCache.get(key)
    if cached:
      toApply.push({ c, cached })
    else:
      toSend.push(c)

  apply(toApply) // 直接写回，更新 nodeFingerprintMap

  unique = dedupByHash(toSend) // 批次去重
  if unique.empty: return

  resp = await background.processTexts(unique.texts)
  // 映射回每个 candidate
  apply(respMappedToCandidates)
  update cache + nodeFingerprintMap
```

---

## 10. 落地改动清单（建议按模块重构）

### 10.1 新增/重构模块
- `core/TextCollector.ts`：只负责采集 Text 节点
- `core/TextPlanner.ts`：shouldProcess/normalize/hash/cache-hit/去重/生成 plan
- `core/TextApplier.ts`：只负责 apply（写回 TextNode）
- `core/NodeFingerprintStore.ts`：WeakMap 管理
- `core/TextCache.ts`：LRU cache（hash key）
- `services/TranslationService.ts`：封装 background messaging + retry + requestId

### 10.2 现有模块的演进建议
- `TextExtractor`：降级为 Collector（不要做 processed 标记）
- `TextProcessor`：变为 orchestrator（串起 Collect/Plan/Dispatch/Apply）
- `DomReplacer`：只保留 Apply（TextNode 写回）；词级富文本放到后续阶段
- `TranslationCache`：改为 hash-key LRU（避免 key 超长）

---

## 11. 观测与调试（必须做，不然难排查）

建议每次 tick 输出（可开关）：
- 扫描到 Text 节点总数
- 过滤后候选数
- 节点 fingerprint 命中数（跳过多少）
- 文本缓存命中数
- 本次发送 uniqueTexts 数量与总字符数
- 本次 apply 成功数量（isConnected 失败数量）

这样你能快速判断“为什么又发后台了”是节点重渲染导致，还是 normalize/hash 不一致导致，还是过滤不够导致。

---

## 12. 风险与边界

- **动态数字/计数**：会导致频繁变化→频繁请求。需要过滤或 normalize 时做数字归一化（可选）。
- **过度改写 UI 文本**：如果不做容器过滤，会把按钮/菜单也改写，影响体验；建议白名单主内容区域。
- **服务 worker 生命周期**：MV3 background 可能休眠，消息请求需容错/重试。

---

## 13. 推荐实施路线（最优但可控）

按优先级分三步落地（每一步都可独立上线验证）：

1) **幂等体系 A+B+C 落地**（WeakMap 指纹 + hash cache + batch dedup）  
2) **过滤体系与容器策略落地**（只处理正文容器、跳过噪音文本）  
3) **高级稳定性**（bfcache pageshow、请求 requestId、失败重试、性能预算上限）  

---

## 14. 与后端接口的契约（当前阶段）

当前阶段接口契约建议固定为：
- 请求：`{ texts: string[], userLevel: string, timestamp, requestId? }`
- 响应：`{ success: true, data: string[] }`（长度与输入 texts 一致）

**强约束**：必须保证顺序与长度对齐，否则回写会错位。

---

## 15. 结语

这套方案的核心是把“是否中文”替换为**真正的幂等与去重体系**，并将采集/策略/网络/回写解耦，使得在知乎这类 SPA 场景下：
- 不会重复浪费后端资源
- 不会因 DOM 结构变化导致替换失败
- 具备后续扩展到“词汇学习模式”的结构基础




