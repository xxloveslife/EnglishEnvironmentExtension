import json
from typing import Optional
import aiohttp
import asyncio
import os
from openai import OpenAI

from config.env import AppConfig


class LLMClient:
    def __init__(self, api_key: str, base_url:str = "https://api.llvm.org/"):
        # 初始化
        # Args:  key ,  url
        self.api_key = api_key or os.getenv("DASHSCOPE_API_KEY") or AppConfig.dashscope_api_key
        if not self.api_key:
            raise ValueError("Please set DASHSCOPE_API_KEY environment variable")
        self.base_url = base_url.rstrip('/')
        self.session: Optional[aiohttp.ClientSession] = None
        self.client = OpenAI(
            # 若没有配置环境变量，请用百炼API Key将下行替换为：api_key="sk-xxx"
            # api_key=os.getenv("DASHSCOPE_API_KEY"),
            # api_key='sk-050494a7fbff4799aa4af58f9ec627a1',
            api_key=self.api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",

        )

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()




    async def translate_batch(self,texts, user_level):

        my_prompts = f"""
            你是一个中英混合学习助手，需要根据用户的英语水平，将中文文本中的部分词汇替换为合适的英文单词，帮助用户在阅读中自然习得新词汇。
            
            **处理规则：**
            1. **用户水平判断**：用户当前英语等级为【{user_level}】。请根据以下标准选择替换词汇：
               - 初级：替换最基础的日常词汇（如名词、简单动词）
               - 中级：替换常见形容词、短语动词、常用表达
               - 高级：替换较专业的术语、学术词汇、惯用语
            2. **替换原则**：
               - 只替换能促进学习的“可习得词汇”（符合i+1输入假说）
               - 保持原句结构和语法完整
               - 不替换专有名词、人名、品牌名
               - 不替换数字、日期、度量单位
               - 不改变UI元素、按钮名称、界面文案
            3. **输出格式**：返回与输入完全相同的列表结构，只修改需要替换的部分
            4. **特殊处理**：
               - 互动类文本（如“赞同 117”、“收藏”）不翻译
               - 标签类文本（如“关注”、“热榜”）不翻译
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

        completion = self.client.chat.completions.create(
            # 模型列表：https://help.aliyun.com/zh/model-studio/getting-started/models
            model="qwen-plus",
            messages=[ # type: ignore
                {"role": "system", "content": my_prompts},
                {"role": "user", "content":  json.dumps(texts, ensure_ascii=False)},
            ]
        )
        translated_texts = json.loads(completion.choices[0].message.content)
        # print(completion.model_dump_json())
        return translated_texts


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