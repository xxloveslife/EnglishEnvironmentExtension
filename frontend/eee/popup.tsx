import React, { useState, useEffect } from "react"
import { Switch, Select, Card, Space, Typography, Divider, Button, message } from "antd"
import { SettingOutlined, BookOutlined, ThunderboltOutlined } from "@ant-design/icons"
import { Storage } from "@plasmohq/storage"
import { UserConfig, EnglishLevel } from "./utils/types"

const { Title, Text } = Typography
const { Option } = Select

function IndexPopup() {
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
        <Space direction="vertical" style={{ width: "100%" }}>
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
              {config.enabled ? "✅ 插件已启用" : "⏸️ 插件已暂停"}
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

export default IndexPopup
