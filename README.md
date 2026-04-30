# course-design

三块 NodeMCU-32S + 电脑前后端分离架构：

- terminal-a（ESP32）
- terminal-b（ESP32）
- gateway（ESP32）
- backend/platform-service（PC 后端）
- web/dashboard（PC 前端）

## 数据流

1. terminal-a / terminal-b ->(ESP-NOW)-> gateway
2. gateway ->(MQTT)-> backend
3. backend ->(WebSocket/HTTP)-> dashboard
4. dashboard 控制 -> backend ->(MQTT)-> gateway ->(ESP-NOW)-> terminal

## 目录

- `firmware/esp32-terminal-a`
- `firmware/esp32-terminal-b`
- `firmware/esp32-gateway`
- `backend/platform-service`
- `web/dashboard`
- `docs`

## 复现文档

- Windows ESP32 环境复现：`docs/windows-esp32-setup.md`
- 产品需求文档（PRD）：`docs/product-prd.md`
