from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from config.get_db import get_db
from exceptions.translate_exceptions import ValidationException, RateLimitException, LLMAPIException, CacheException
from module_admin.entity.vo.translate_vo import TranslateModel
from module_admin.service.login_service import LoginService

from module_admin.entity.vo.user_vo import CurrentUserModel
from module_admin.service.translate_service import TranslateService
from utils.log_util import logger
from utils.response_util import ResponseUtil

translateController = APIRouter()


def get_redis(request: Request):
    """
    获取Redis客户端

    Args:
        request: FastAPI请求对象

    Returns:
        Redis客户端实例或None
    """
    return getattr(request.app.state, 'redis', None)


@translateController.post('/trans')
async def translate_texts(
    trans_request: TranslateModel,
    request: Request,
    current_user: CurrentUserModel = Depends(LoginService.get_current_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis)
):
    """
    翻译文本接口

    Args:
        trans_request: 翻译请求模型
        request: FastAPI请求对象
        current_user: 当前登录用户
        db: 数据库会话
        redis: Redis客户端

    Returns:
        翻译结果响应
    """
    # ✅ 记录请求接收
    logger.bind(
        user_id=current_user.user.user_id,
        endpoint="/trans",
        method="POST"
    ).info("Translation request received", extra={
        "text_count": len(trans_request.texts),
        "user_level": trans_request.user_level.value,
        "ip": request.client.host
    })

    try:
        # ✅ 正常处理逻辑
        translated_texts = await TranslateService.translate_texts(
            trans_request,
            current_user,
            db,
            redis=redis
        )

        # ✅ 记录成功响应
        logger.bind(user_id=current_user.user.user_id).info(
            "Translation completed successfully",
            extra={"result_count": len(translated_texts)}
        )

        return ResponseUtil.success(data=translated_texts)

    except ValidationException as e:
        # ✅ 输入验证错误 (400)
        logger.warning(
            f"Validation failed: {e.message}",
            extra={"user_id": current_user.user.user_id}
        )
        return ResponseUtil.error(msg=e.message, dict_content={'code': e.code})

    except RateLimitException as e:
        # ✅ 速率限制错误 (429)
        logger.warning(
            f"Rate limit exceeded: {e.message}",
            extra={"user_id": current_user.user.user_id}
        )
        return ResponseUtil.error(
            msg="请求过于频繁，请稍后再试",
            dict_content={'code': e.code}
        )

    except LLMAPIException as e:
        # ✅ LLM API 错误 (503)
        logger.error(
            f"LLM API error: {e.message}",
            exc_info=True,
            extra={"user_id": current_user.user.user_id}
        )
        return ResponseUtil.error(
            msg="翻译服务暂时不可用，请稍后重试",
            dict_content={'code': e.code}
        )

    except CacheException as e:
        # ⚠️ 缓存错误不影响主流程，降级处理
        logger.warning(
            f"Cache error (fallback to direct API): {e.message}",
            extra={"user_id": current_user.user.user_id}
        )
        # 可以选择降级处理或返回错误
        # 这里选择记录警告但继续处理
        return ResponseUtil.error(msg="缓存服务异常，已降级处理")

    except Exception as e:
        # ✅ 未预期错误 (500)
        logger.exception(
            f"Unexpected error: {e}",
            extra={"user_id": current_user.user.user_id}
        )
        return ResponseUtil.error(msg="服务器内部错误，请联系管理员")
