"""翻译服务自定义异常"""

class TranslateException(Exception):
    """翻译服务基础异常"""
    def __init__(self, message: str, code: int = 500):
        self.message = message
        self.code = code
        super().__init__(self.message)

class ValidationException(TranslateException):
    """输入验证异常 (400)"""
    def __init__(self, message: str):
        super().__init__(message, code=400)

class RateLimitException(TranslateException):
    """速率限制异常 (429)"""
    def __init__(self, message: str):
        super().__init__(message, code=429)

class LLMAPIException(TranslateException):
    """LLM API 调用异常 (503)"""
    def __init__(self, message: str):
        super().__init__(message, code=503)

class CacheException(TranslateException):
    """缓存操作异常 (500)"""
    def __init__(self, message: str):
        super().__init__(message, code=500)