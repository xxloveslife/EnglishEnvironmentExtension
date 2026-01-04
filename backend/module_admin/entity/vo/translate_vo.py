from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from typing import Any, Optional, List

class UserLevel(str, Enum):
    """用户水平枚举"""
    A1 = "A1"  # 入门级
    A2 = "A2"  # 初级
    B1 = "B1"  # 中级
    B2 = "B2"  # 中高级
    C1 = "C1"  # 高级
    C2 = "C2"  # 精通级

class TranslateModel(BaseModel):
    '''
    暂时考虑接收的数据texts:string[],  userLevel:string
    '''

    model_config = ConfigDict(alias_generator=to_camel)
    texts: List[str] = Field(..., description='需要翻译的文本数组',min_length=1,max_length=50)
    # A1 - C2  ,todo 添加level必须是A1 - C2里面的一个值的校验
    user_level: UserLevel  = Field(...,description='user level')

    @field_validator('texts')
    @classmethod
    def validate_texts(cls, texts: List[str]) -> List[str]:
        """验证文本数组的每个元素"""
        if not texts:
            raise ValueError("texts 不能为空数组")

        validated = []
        for idx, text in enumerate(texts):
            # 去除首尾空格
            text = text.strip()

            # 检查是否为空
            if not text:
                raise ValueError(f"texts[{idx}] 不能为空字符串或纯空格")

            # 检查长度限制
            if len(text) > 1000:
                raise ValueError(
                    f"texts[{idx}] 长度超过限制 "
                    f"(当前: {len(text)}, 最大: 1000)"
                )

            validated.append(text)

        return validated

class TranslationItem(BaseModel):
    '''
    单个翻译模型
    '''
    model_config = ConfigDict(alias_generator=to_camel)

    original_text:str = Field(description='原始文字')
    translated_text: str = Field(description='翻译后的文字')
    phonetic: str = Field(description='音标')
    chinese: str = Field(description='中文')
    confidence: str = Field(description='置信度')

class TranslateResponse(BaseModel):
    '''
    翻译response模型
    '''
    code: int = Field(description='状态码')
    msg: Optional[str]= Field(default=None, description='infomation')
    success:bool = Field(description='is success')
    data: Optional[Any] = Field(description='data')
    time: str = Field(description='time')