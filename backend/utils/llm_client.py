import json
import time
from typing import Optional, List
import aiohttp
import asyncio
import os
from openai import OpenAI

from config.env import AppConfig
from exceptions.translate_exceptions import LLMAPIException
from utils.log_util import logger


class LLMClient:
    def __init__(self, api_key: str, base_url: str = "https://api.llvm.org/"):
        """
        初始化LLM客户端

        Args:
            api_key: API密钥
            base_url: API基础URL

        Raises:
            ValueError: API密钥未设置时
        """
        # 优先级: 传入参数 > 环境变量 > 配置文件
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY") or AppConfig.dashscope_api_key

        if not self.api_key:
            raise ValueError("DASHSCOPE_API_KEY must be set in environment or config")

        self.base_url = base_url.rstrip('/')
        self.session: Optional[aiohttp.ClientSession] = None
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def translate_batch(self, texts: List[str], user_level: str, timeout: int = 30) -> List[str]:
        """
        批量翻译文本（带重试和超时）

        Args:
            texts: 文本数组
            user_level: 用户等级
            timeout: 超时时间（秒）

        Returns:
            翻译后的文本列表

        Raises:
            LLMAPIException: LLM API 调用失败
        """
        start_time = time.time()

        # ✅ 记录 API 调用开始
        logger.debug("Calling LLM API", extra={
            "model": "qwen-plus",
            "text_count": len(texts),
            "user_level": user_level
        })

        try:
            my_prompts = f"""
你是一个中英混合学习助手，需要根据用户的英语水平，将中文文本中的部分词汇替换为合适的英文单词，帮助用户在阅读中自然习得新词汇。

**处理规则：**
1. **用户水平判断**：用户当前英语等级为【{user_level}】。请根据以下标准选择替换词汇：
   - 初级：替换最基础的日常词汇（如名词、简单动词）
   - 中级：替换常见形容词、短语动词、常用表达
   - 高级：替换较专业的术语、学术词汇、惯用语
2. **替换原则**：
   - 只替换能促进学习的"可习得词汇"（符合i+1输入假说）
   - 保持原句结构和语法完整
   - 不替换专有名词、人名、品牌名
   - 不替换数字、日期、度量单位
   - 不改变UI元素、按钮名称、界面文案
3. **输出格式**：返回与输入完全相同的列表结构，只修改需要替换的部分
4. **特殊处理**：
   - 互动类文本（如"赞同 117"、"收藏"）不翻译
   - 标签类文本（如"关注"、"热榜"）不翻译
   - 长段落只替换3-5个关键词，避免过度替换
   - 保持原文情感色彩和口语风格

**示例参考：**
用户等级：初级
输入：["我喜欢读书", "今天天气真好"]
输出：["我喜欢读books", "今天weather真好"]

用户等级：中级
输入：["他经常熬夜工作"]
输出：["他经常stay up late工作"]

用户等级：高级
输入：["这个观点很有洞察力"]
输出：["这个perspective很有insight"]

**当前任务：**
用户等级：{user_level}


请返回处理后的完整列表，保持原有顺序和长度。只输出JSON格式的列表，不要额外解释。
"""

            # ✅ 使用 asyncio.wait_for 添加超时
            completion = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.chat.completions.create,
                    model="qwen-plus",
                    messages=[
                        {"role": "system", "content": my_prompts},
                        {"role": "user", "content": json.dumps(texts, ensure_ascii=False)},
                    ]
                ),
                timeout=timeout
            )

            # ✅ 解析响应
            translated_texts = self._parse_response(completion)

            # ✅ 记录 API 调用成功
            elapsed_ms = int((time.time() - start_time) * 1000)
            logger.info("LLM API call successful", extra={
                "model": "qwen-plus",
                "text_count": len(texts),
                "tokens_used": completion.usage.total_tokens if hasattr(completion, 'usage') else None,
                "latency_ms": elapsed_ms
            })

            return translated_texts

        except asyncio.TimeoutError:
            # ✅ 超时错误
            elapsed = int((time.time() - start_time) * 1000)
            logger.error(f"LLM API timeout after {elapsed}ms (limit: {timeout}s)")
            raise LLMAPIException(f"翻译请求超时（{timeout}秒）")

        except json.JSONDecodeError as e:
            # ✅ JSON 解析错误
            logger.error(f"Failed to parse LLM response: {e}")
            raise LLMAPIException("LLM 返回格式错误")

        except Exception as e:
            # ✅ 其他错误
            error_msg = str(e)
            logger.error(f"LLM API call failed: {error_msg}", exc_info=True)

            # 根据错误类型提供友好消息
            if "authentication" in error_msg.lower():
                raise LLMAPIException("API 认证失败，请检查密钥配置")
            elif "rate_limit" in error_msg.lower():
                raise LLMAPIException("API 调用频率超限，请稍后重试")
            else:
                raise LLMAPIException(f"LLM API 调用失败: {error_msg}")

    def _parse_response(self, completion) -> List[str]:
        """
        解析 LLM 响应

        Args:
            completion: LLM API响应对象

        Returns:
            翻译后的文本列表

        Raises:
            LLMAPIException: 响应格式错误时
        """
        try:
            content = completion.choices[0].message.content
            translated_texts = json.loads(content)

            if not isinstance(translated_texts, list):
                raise LLMAPIException("LLM 返回格式错误: 期望数组")

            return translated_texts

        except (IndexError, AttributeError, KeyError) as e:
            logger.error(f"Invalid completion structure: {e}")
            raise LLMAPIException("LLM 响应结构异常")


# 测试代码 - 使用 async with
async def test_with_context():
    print("🚀 使用上下文管理器测试...")

    # 使用异步上下文管理器
    async with LLMClient(api_key="dummy_key") as client:
        await client.translate_batch(
            texts=["测试文本1", "测试文本2"],
            user_level="高级"
        )

    print("✅ 测试完成！上下文管理器会自动关闭session")


# 测试
if __name__ == "__main__":
    asyncio.run(test_with_context())
