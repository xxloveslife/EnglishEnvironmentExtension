import time
from typing import List

from pydantic import BaseModel

from exceptions.translate_exceptions import ValidationException, LLMAPIException
from utils.cache_helper import TranslationCacheHelper
from utils.llm_client import LLMClient
from utils.log_util import logger


class TranslateService:
    @classmethod
    async def translate_texts(cls, trans_request, current_user, db, redis=None):
        """
        翻译文本服务

        Args:
            trans_request: 翻译请求模型
            current_user: 当前用户
            db: 数据库会话
            redis: Redis客户端(可选)

        Returns:
            翻译后的文本列表

        Raises:
            ValidationException: 输入验证失败
            LLMAPIException: LLM API调用失败
        """
        start_time = time.time()

        texts = trans_request.texts
        user_level = trans_request.user_level.value

        # ✅ Step 1: 业务验证
        if not texts:
            raise ValidationException("texts 不能为空")

        if len(texts) > 50:
            raise ValidationException(f"texts 数量超过限制 (当前: {len(texts)}, 最大: 50)")

        # ✅ 记录业务逻辑开始
        logger.bind(user_id=current_user.user.user_id).info(
            "Starting translation processing",
            extra={
                "text_count": len(texts),
                "user_level": user_level
            }
        )

        # ✅ Step 2: 请求去重（保持顺序）
        unique_texts = list(dict.fromkeys(texts))
        dedup_saved = len(texts) - len(unique_texts)

        if dedup_saved > 0:
            logger.info(f"Deduplication: {len(texts)} → {len(unique_texts)} (saved {dedup_saved})")

        # ✅ Step 3: 缓存检查（对唯一文本）
        cached_translations = {}
        uncached_texts = unique_texts

        if redis:
            try:
                cache_helper = TranslationCacheHelper(redis)
                cache_results = await cache_helper.get_many(unique_texts, user_level)

                cached_translations = {
                    text: cached
                    for text, cached in cache_results.items()
                    if cached is not None
                }

                uncached_texts = [
                    text for text in unique_texts
                    if text not in cached_translations
                ]

                logger.bind(user_id=current_user.user.user_id).info(
                    f"Cache: {len(cached_translations)} hits, {len(uncached_texts)} misses, "
                    f"dedup saved: {dedup_saved}"
                )
            except Exception as e:
                logger.warning(f"Cache check failed, fallback to API: {e}")
                uncached_texts = unique_texts

        # ✅ Step 4: 翻译未缓存的唯一文本
        llm_translations = {}
        if uncached_texts:
            try:
                async with LLMClient(api_key="") as client:
                    translated_list = await client.translate_batch(
                        texts=uncached_texts,
                        user_level=user_level
                    )

                    if not translated_list or len(translated_list) != len(uncached_texts):
                        raise LLMAPIException(
                            f"LLM 返回结果数量不匹配 "
                            f"(expected: {len(uncached_texts)}, got: {len(translated_list) if translated_list else 0})"
                        )

                    llm_translations = dict(zip(uncached_texts, translated_list))

                    # ✅ Step 5: 缓存新翻译
                    if redis:
                        try:
                            cache_helper = TranslationCacheHelper(redis)
                            await cache_helper.set_many(llm_translations, user_level)
                        except Exception as e:
                            logger.warning(f"Cache set failed: {e}")

            except LLMAPIException:
                # ✅ 重新抛出已知异常
                raise

            except Exception as e:
                # ✅ 未知异常转换为 LLMAPIException
                logger.error(f"Unexpected error in Service: {e}", exc_info=True)
                raise LLMAPIException(f"翻译处理失败: {str(e)}")

        # ✅ Step 6: 合并所有翻译
        all_translations = {**cached_translations, **llm_translations}

        # ✅ Step 7: 映射回原始顺序（包括重复项）
        result = [all_translations.get(text, text) for text in texts]

        # ✅ 记录处理结果
        elapsed_ms = int((time.time() - start_time) * 1000)
        logger.bind(user_id=current_user.user.user_id).info(
            "Translation processing completed",
            extra={
                "text_count": len(texts),
                "unique_count": len(unique_texts),
                "cache_hits": len(cached_translations),
                "api_calls": len(uncached_texts),
                "latency_ms": elapsed_ms,
                "user_level": user_level
            }
        )

        return result
