import { StorageService } from "./services/StorageService"
import { ResponseCode } from "./utils/types"
import type { ApiResponse } from "./utils/types"
import { logger } from "./utils/logger"

/**
 * MV3 background/service worker
 * 用于代发跨域请求（绕开页面 Origin 的 CORS 限制）
 */

const API_BASE_URL = "http://127.0.0.1:9099"

type ProcessTextsMessage = {
  type: "EEE_PROCESS_TEXTS"
  payload: {
    texts: string[]
    userLevel: string
  }
}

type ProcessTextsResponse =
  | { ok: true; data: string[] }
  | { ok: false; error: string; code?: number }

const storageService = new StorageService()

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const run = async () => {
    if (!message || typeof message !== "object") {
      return
    }

    const msg = message as Partial<ProcessTextsMessage>
    if (msg.type !== "EEE_PROCESS_TEXTS") {
      return
    }

    const texts = msg.payload?.texts ?? []
    const userLevel = msg.payload?.userLevel ?? "B1"

    try {
      const token = await storageService.getToken()

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      }

      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const resp = await fetch(`${API_BASE_URL}/trans`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          texts,
          userLevel,
          timestamp: Date.now()
        })
      })

      // 后端如果不是 JSON，会抛异常；这里统一成可读错误
      const data = (await resp.json()) as ApiResponse<unknown>

      if (data.code === ResponseCode.UNAUTHORIZED) {
        await storageService.clearAuth()
        const result: ProcessTextsResponse = { ok: false, error: "登录已过期，请重新登录", code: data.code }
        sendResponse(result)
        return
      }

      if (data.success && Array.isArray(data.data) && data.data.every((x) => typeof x === "string")) {
        const result: ProcessTextsResponse = { ok: true, data: data.data as string[] }
        sendResponse(result)
        return
      }

      const result: ProcessTextsResponse = { ok: false, error: data.msg || "翻译请求失败", code: data.code }
      sendResponse(result)
    } catch (e) {
      logger.error("background /trans 代发失败:", e)
      const result: ProcessTextsResponse = { ok: false, error: e instanceof Error ? e.message : "请求失败" }
      sendResponse(result)
    }
  }

  void run()
  return true // keep channel open for async sendResponse
})


