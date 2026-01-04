"""翻译缓存辅助类"""
import hashlib
from typing import Optional, List, Dict
from redis import asyncio as aioredis
from utils.log_util import logger


class TranslationCacheHelper:
    """翻译缓存辅助类"""

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client
        self.prefix = "translate"
        self.ttl = 3600  # 1 hour

    def _generate_cache_key(self, text: str, user_level: str) -> str:
        """
        生成缓存键

        Args:
            text: 原始文本
            user_level: 用户等级

        Returns:
            缓存键, 格式: translate:{md5}:{level}
        """
        # ✅ 使用 MD5 哈希文本
        text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
        return f"{self.prefix}:{text_hash}:{user_level}"

    async def get(self, text: str, user_level: str) -> Optional[str]:
        """
        获取单个翻译缓存

        Args:
            text: 原始文本
            user_level: 用户等级

        Returns:
            翻译文本 或 None
        """
        key = self._generate_cache_key(text, user_level)

        try:
            cached = await self.redis.get(key)
            if cached:
                logger.debug(f"Cache hit: {key}")
                return cached if isinstance(cached, str) else cached.decode('utf-8')
            else:
                logger.debug(f"Cache miss: {key}")
                return None

        except Exception as e:
            # ⚠️ 缓存失败不应影响主流程
            logger.warning(f"Cache get failed: {e}")
            return None

    async def set(self, text: str, user_level: str, translated: str) -> bool:
        """
        设置单个翻译缓存

        Args:
            text: 原始文本
            user_level: 用户等级
            translated: 翻译文本

        Returns:
            是否成功
        """
        key = self._generate_cache_key(text, user_level)

        try:
            # ✅ 使用 SETEX 同时设置值和 TTL
            await self.redis.setex(
                key,
                self.ttl,
                translated
            )
            logger.debug(f"Cache set: {key}")
            return True

        except Exception as e:
            logger.warning(f"Cache set failed: {e}")
            return False

    async def get_many(self, texts: List[str], user_level: str) -> Dict[str, Optional[str]]:
        """
        批量获取翻译缓存 (性能优化)

        Args:
            texts: 文本数组
            user_level: 用户等级

        Returns:
            字典 {text: translated | None}
        """
        if not texts:
            return {}

        # ✅ 生成所有缓存键
        keys = [self._generate_cache_key(text, user_level) for text in texts]

        try:
            # ✅ 使用 MGET 批量获取（一次网络往返）
            cached_values = await self.redis.mget(keys)

            # ✅ 构建结果字典
            result = {}
            for text, value in zip(texts, cached_values):
                if value:
                    result[text] = value if isinstance(value, str) else value.decode('utf-8')
                else:
                    result[text] = None

            hit_count = sum(1 for v in result.values() if v is not None)
            logger.debug(f"Cache batch get: {hit_count}/{len(texts)} hits")

            return result

        except Exception as e:
            logger.warning(f"Cache mget failed: {e}")
            # ⚠️ 失败时返回全部 None
            return {text: None for text in texts}

    async def set_many(self, translations: Dict[str, str], user_level: str) -> int:
        """
        批量设置翻译缓存 (性能优化)

        Args:
            translations: 字典 {text: translated}
            user_level: 用户等级

        Returns:
            成功设置的数量
        """
        if not translations:
            return 0

        try:
            # ✅ 使用 Pipeline 批量设置（一次网络往返）
            pipe = self.redis.pipeline()

            for text, translated in translations.items():
                key = self._generate_cache_key(text, user_level)
                pipe.setex(key, self.ttl, translated)

            # ✅ 执行 Pipeline
            results = await pipe.execute()
            success_count = sum(1 for r in results if r)

            logger.debug(f"Cache batch set: {success_count}/{len(translations)} successful")
            return success_count

        except Exception as e:
            logger.warning(f"Cache mset failed: {e}")
            return 0
