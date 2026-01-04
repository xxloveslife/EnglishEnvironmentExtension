import React, { useState, useEffect } from "react"
import {
  Switch,
  Select,
  Card,
  Space,
  Typography,
  Divider,
  Button,
  message,
  Input,
  Form,
  Avatar,
  Spin
} from "antd"
import {
  SettingOutlined,
  BookOutlined,
  ThunderboltOutlined,
  UserOutlined,
  LockOutlined,
  SafetyOutlined,
  LogoutOutlined,
  ReloadOutlined
} from "@ant-design/icons"
import { Storage } from "@plasmohq/storage"
import { EnglishLevel } from "./utils/types"
import type { UserConfig, AuthState, UserInfo, CaptchaResponse } from "./utils/types"
import { apiClient } from "./services/ApiService"
import { StorageService } from "./services/StorageService"

const { Title, Text } = Typography
const { Option } = Select

// 登录表单组件
function LoginForm({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [captcha, setCaptcha] = useState<CaptchaResponse | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(false)

  // 获取验证码
  const fetchCaptcha = async () => {
    setCaptchaLoading(true)
    try {
      const response = await apiClient.getCaptcha()
      if (response.success) {
        setCaptcha(response)
        form.setFieldValue('code', '')
      } else {
        message.error(response.msg || '获取验证码失败')
      }
    } catch (error) {
      message.error('获取验证码失败，请检查网络连接')
      console.error('获取验证码失败:', error)
    } finally {
      setCaptchaLoading(false)
    }
  }

  // 初始加载验证码
  useEffect(() => {
    fetchCaptcha()
  }, [])

  // 处理登录
  const handleLogin = async (values: { username: string; password: string; code: string }) => {
    setLoading(true)
    try {
      const response = await apiClient.login({
        username: values.username,
        password: values.password,
        code: captcha?.captchaEnabled ? values.code : undefined,
        uuid: captcha?.uuid
      })

      if (response.success) {
        message.success('登录成功')
        onLoginSuccess()
      } else {
        message.error(response.msg || '登录失败')
        // 登录失败刷新验证码
        fetchCaptcha()
      }
    } catch (error) {
      message.error('登录失败，请检查网络连接')
      console.error('登录失败:', error)
      fetchCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: 320, padding: 16 }}>
      <Card
        title={
          <Space>
            <BookOutlined />
            <span>英语学习助手</span>
          </Space>
        }
        size="small"
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Text type="secondary">请登录后使用</Text>
        </div>

        <Form
          form={form}
          onFinish={handleLogin}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              size="middle"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="middle"
            />
          </Form.Item>

          {captcha?.captchaEnabled && (
            <Form.Item
              name="code"
              rules={[{ required: true, message: '请输入验证码' }]}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  prefix={<SafetyOutlined />}
                  placeholder="验证码"
                  size="middle"
                  style={{ flex: 1 }}
                />
                <div
                  style={{
                    cursor: 'pointer',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 100,
                    height: 32
                  }}
                  onClick={fetchCaptcha}
                  title="点击刷新验证码"
                >
                  {captchaLoading ? (
                    <Spin size="small" />
                  ) : captcha?.img ? (
                    <img
                      src={`data:image/png;base64,${captcha.img}`}
                      alt="验证码"
                      style={{ height: '100%' }}
                    />
                  ) : (
                    <ReloadOutlined />
                  )}
                </div>
              </div>
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

// 设置面板组件
function SettingsPanel({
  userInfo,
  onLogout
}: {
  userInfo: UserInfo | null
  onLogout: () => void
}) {
  const [config, setConfig] = useState<UserConfig>({
    enabled: false,
    userLevel: EnglishLevel.B1,
    processingConfig: {
      onPageLoad: true,
      onScroll: true,
      onDomChange: false
    }
  })
  const [loading, setLoading] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  const storage = new Storage({
    area: "local"
  })

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await storage.get<UserConfig>("userConfig")
        if (savedConfig) {
          setConfig(savedConfig)
        }
      } catch (error) {
        console.error("加载配置失败:", error)
      }
    }
    loadConfig()
  }, [])

  // 保存配置
  const saveConfig = async (newConfig: Partial<UserConfig>) => {
    setLoading(true)
    try {
      const updatedConfig = { ...config, ...newConfig }
      await storage.set("userConfig", updatedConfig)
      setConfig(updatedConfig)
      message.success("配置已保存")
    } catch (error) {
      message.error("保存配置失败")
      console.error("保存配置失败:", error)
    } finally {
      setLoading(false)
    }
  }

  // 处理开关变化
  const handleEnabledChange = (checked: boolean) => {
    saveConfig({ enabled: checked })
  }

  // 处理英语水平变化
  const handleLevelChange = (level: string) => {
    saveConfig({ userLevel: level as EnglishLevel })
  }

  // 处理处理配置变化
  const handleProcessingConfigChange = (key: keyof UserConfig["processingConfig"], value: boolean) => {
    saveConfig({
      processingConfig: {
        ...config.processingConfig,
        [key]: value
      }
    })
  }

  // 处理退出登录
  const handleLogout = async () => {
    setLogoutLoading(true)
    try {
      await apiClient.logout()
      message.success('已退出登录')
      onLogout()
    } catch (error) {
      message.error('退出登录失败')
      console.error('退出登录失败:', error)
    } finally {
      setLogoutLoading(false)
    }
  }

  return (
    <div style={{ width: 320, padding: 16 }}>
      <Card
        title={
          <Space>
            <BookOutlined />
            <span>英语学习助手</span>
          </Space>
        }
        size="small"
        extra={
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            loading={logoutLoading}
            size="small"
            danger
          >
            退出
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {/* 用户信息 */}
          {userInfo && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  src={userInfo.avatar}
                />
                <div>
                  <Text strong>{userInfo.nickName || userInfo.userName}</Text>
                </div>
              </div>
              <Divider style={{ margin: "12px 0" }} />
            </>
          )}

          {/* 主开关 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Text strong>启用插件</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                智能替换页面中的中文词汇
              </Text>
            </div>
            <Switch
              checked={config.enabled}
              onChange={handleEnabledChange}
              loading={loading}
            />
          </div>

          <Divider style={{ margin: "12px 0" }} />

          {/* 英语水平选择 */}
          <div>
            <Text strong>英语水平</Text>
            <br />
            <Select
              value={config.userLevel}
              onChange={handleLevelChange}
              style={{ width: "100%", marginTop: 8 }}
              disabled={!config.enabled}
            >
              <Option value={EnglishLevel.A1}>A1 - 入门级</Option>
              <Option value={EnglishLevel.A2}>A2 - 初级</Option>
              <Option value={EnglishLevel.B1}>B1 - 中级</Option>
              <Option value={EnglishLevel.B2}>B2 - 中高级</Option>
              <Option value={EnglishLevel.C1}>C1 - 高级</Option>
              <Option value={EnglishLevel.C2}>C2 - 精通级</Option>
            </Select>
          </div>

          <Divider style={{ margin: "12px 0" }} />

          {/* 处理配置 */}
          <div>
            <Space>
              <ThunderboltOutlined />
              <Text strong>处理设置</Text>
            </Space>

            <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text>页面加载时处理</Text>
                <Switch
                  size="small"
                  checked={config.processingConfig.onPageLoad}
                  onChange={(checked) => handleProcessingConfigChange("onPageLoad", checked)}
                  disabled={!config.enabled}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text>滚动时处理</Text>
                <Switch
                  size="small"
                  checked={config.processingConfig.onScroll}
                  onChange={(checked) => handleProcessingConfigChange("onScroll", checked)}
                  disabled={!config.enabled}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text>DOM变化时处理</Text>
                <Switch
                  size="small"
                  checked={config.processingConfig.onDomChange}
                  onChange={(checked) => handleProcessingConfigChange("onDomChange", checked)}
                  disabled={!config.enabled}
                />
              </div>
            </Space>
          </div>

          <Divider style={{ margin: "12px 0" }} />

          {/* 状态信息 */}
          <div style={{ textAlign: "center" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {config.enabled ? "插件已启用" : "插件已暂停"}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前水平: {config.userLevel}
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  )
}

// 主组件
function IndexPopup() {
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [loading, setLoading] = useState(true)
  const storageService = new StorageService()

  // 加载认证状态
  const loadAuthState = async () => {
    try {
      const state = await storageService.getAuthState()
      setAuthState(state)
    } catch (error) {
      console.error('加载认证状态失败:', error)
      setAuthState({
        isLoggedIn: false,
        token: null,
        userInfo: null
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuthState()

    // 监听认证状态变化
    const unsubscribe = storageService.watchAuthState((newState) => {
      setAuthState(newState)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // 加载中状态
  if (loading) {
    return (
      <div style={{ width: 320, padding: 16, textAlign: 'center' }}>
        <Spin tip="加载中..." />
      </div>
    )
  }

  // 未登录显示登录表单
  if (!authState?.isLoggedIn) {
    return <LoginForm onLoginSuccess={loadAuthState} />
  }

  // 已登录显示设置面板
  return (
    <SettingsPanel
      userInfo={authState.userInfo}
      onLogout={loadAuthState}
    />
  )
}

export default IndexPopup
