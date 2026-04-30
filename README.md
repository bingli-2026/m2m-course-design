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
- 全局协议基线（MQTT/HTTP）：`docs/protocol-contract.md`

## 全栈联调（热更新）

- 一键启动前后端热更新开发环境：
  - `bash scripts/dev-fullstack.sh`
- 服务端口：
  - 后端 API：`http://127.0.0.1:8080`
  - 前端开发服务器：`http://127.0.0.1:5173`

## 联调冒烟脚本

- 一键验证 telemetry -> command -> mqtt ack -> 状态/事件回写链路：
  - `bash scripts/smoke-e2e.sh`

## 本地真实部署

- 启动（非 dev 模式）：
  - `bash scripts/deploy-stack.sh`
- 停止：
  - `bash scripts/stop-stack.sh`
- 详细流程：
  - `docs/deployment-and-test-plan.md`
