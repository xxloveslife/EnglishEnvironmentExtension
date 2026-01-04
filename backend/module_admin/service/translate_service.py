from typing import List

from pydantic import BaseModel

from utils.llm_client import LLMClient


class TranslateService:
    @classmethod
    async def translate_texts(cls, trans_request, current_user, db):
        texts = trans_request.texts;
        user_level = trans_request.user_level;
        async with LLMClient(api_key="dummy_key") as client:
            translated = await client.translate_batch(
                texts=texts,
                user_level=user_level
            )

        return translated

